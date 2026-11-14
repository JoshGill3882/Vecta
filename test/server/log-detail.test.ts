import { describe, it, expect } from "vitest";
import { NotFoundError } from "@/src/server/errors";
import { CIRCULAR, REDACTED, prepareDetail, scrubUrlCredentials } from "@/src/server/log-detail";

/* Each sensitive key the log must never carry, as the app or a library names
   it. Every one is checked at the top level, nested, and inside an array. */
const SENSITIVE: [string, string][] = [
  ["the admin password, as the environment names it", "ADMIN_PASSWORD"],
  ["the admin password, as code names it", "adminPassword"],
  ["a password submitted at sign-in", "password"],
  ["the session secret, as the environment names it", "SESSION_SECRET"],
  ["the session secret, as code names it", "sessionSecret"],
  ["a session", "session"],
  ["a cookie", "cookie"],
  ["a request's cookies", "cookies"],
  ["a response's Set-Cookie header", "set-cookie"],
];

describe("prepareDetail: sensitive keys", () => {
  it.each(SENSITIVE)("redacts %s (%s)", (_, key) => {
    expect(prepareDetail({ [key]: "hunter2", kept: "yes" })).toEqual({
      [key]: REDACTED,
      kept: "yes",
    });
  });

  it.each(SENSITIVE)("redacts %s (%s) when nested", (_, key) => {
    const prepared = prepareDetail({ request: { headers: { [key]: "hunter2" } } });
    expect(prepared).toEqual({ request: { headers: { [key]: REDACTED } } });
  });

  it.each(SENSITIVE)("redacts %s (%s) inside an array", (_, key) => {
    expect(prepareDetail({ attempts: [{ [key]: "hunter2" }] })).toEqual({
      attempts: [{ [key]: REDACTED }],
    });
  });

  it("redacts an object or array held under a sensitive key, not just a string", () => {
    expect(prepareDetail({ session: { isLoggedIn: true }, cookies: ["a=1"] })).toEqual({
      session: REDACTED,
      cookies: REDACTED,
    });
  });

  it.each(["Password", "PASSWORD", "new_password", "Session-Secret", "SET_COOKIE"])(
    "ignores case, underscores and hyphens when matching %s",
    (key) => {
      expect(prepareDetail({ [key]: "hunter2" })).toEqual({ [key]: REDACTED });
    }
  );

  it.each(["passwordHint", "sessionCount", "cookieConsent", "id", "title", "secretary"])(
    "leaves %s alone, since it only resembles a sensitive key",
    (key) => {
      expect(prepareDetail({ [key]: "visible" })).toEqual({ [key]: "visible" });
    }
  );

  it("never shows a redacted value anywhere in the serialised result", () => {
    const detail = Object.fromEntries(SENSITIVE.map(([, key]) => [key, "hunter2"]));
    expect(JSON.stringify(prepareDetail({ ...detail, nested: [detail] }))).not.toContain("hunter2");
  });
});

describe("prepareDetail: database URL credentials", () => {
  it("removes the user and password from DATABASE_URL, keeping the host for diagnosis", () => {
    const prepared = prepareDetail({
      DATABASE_URL: "postgresql://vecta:s3cret@db.internal:5432/vecta?schema=public",
    });
    expect(prepared).toEqual({
      DATABASE_URL: `postgresql://${REDACTED}@db.internal:5432/vecta?schema=public`,
    });
  });

  it("removes credentials from a URL inside an error's message and stack", () => {
    const error = new Error("Can't reach postgres://vecta:s3cret@db:5432/vecta");
    const prepared = prepareDetail({ error }) as { error: { message: string; stack: string } };

    expect(prepared.error.message).toBe(`Can't reach postgres://${REDACTED}@db:5432/vecta`);
    expect(prepared.error.stack).not.toContain("s3cret");
  });

  it("leaves a SQLite file URL, which has no credentials, as it is", () => {
    expect(prepareDetail({ DATABASE_URL: "file:./data/app.db" })).toEqual({
      DATABASE_URL: "file:./data/app.db",
    });
  });
});

describe("scrubUrlCredentials", () => {
  it.each([
    ["postgresql://u:p@h:5432/d", `postgresql://${REDACTED}@h:5432/d`],
    ["postgres://user@h/d", `postgres://${REDACTED}@h/d`],
    [
      "see https://a:b@example.com/x and postgres://c:d@h/y",
      `see https://${REDACTED}@example.com/x and postgres://${REDACTED}@h/y`,
    ],
    ["https://example.com/users/@me", "https://example.com/users/@me"],
    ["https://example.com/?to=a@b.c", "https://example.com/?to=a@b.c"],
    ["mail me at a@b.c", "mail me at a@b.c"],
    ["no URL here", "no URL here"],
  ])("turns %j into %j", (input, expected) => {
    expect(scrubUrlCredentials(input)).toBe(expected);
  });
});

describe("prepareDetail: errors", () => {
  it("spells out an error's name, message and stack, which JSON would drop", () => {
    const error = new TypeError("bad input");
    const prepared = prepareDetail({ error }) as { error: Record<string, unknown> };

    expect(JSON.stringify({ error })).toBe('{"error":{}}');
    expect(prepared.error).toMatchObject({ name: "TypeError", message: "bad input" });
    expect(prepared.error.stack).toContain("bad input");
  });

  it("keeps an error's own fields, such as a Prisma error's code", () => {
    const error = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["name"] },
    });

    expect(prepareDetail({ error }).error).toMatchObject({
      code: "P2002",
      meta: { target: ["name"] },
      message: "Unique constraint failed",
    });
  });

  it("redacts a sensitive field an error carries", () => {
    const error = Object.assign(new Error("Sign-in failed"), { password: "hunter2" });
    expect(prepareDetail({ error }).error).toMatchObject({ password: REDACTED });
  });

  it("includes an error's cause, itself spelled out", () => {
    const error = new Error("Saving failed", { cause: new RangeError("disk full") });
    expect(prepareDetail({ error }).error).toMatchObject({
      message: "Saving failed",
      cause: { name: "RangeError", message: "disk full" },
    });
  });

  it("keeps the name and code a domain error sets for itself", () => {
    expect(prepareDetail({ error: new NotFoundError("Task", "t1") }).error).toMatchObject({
      name: "NotFoundError",
      code: "NOT_FOUND",
      message: "Task with id t1 was not found",
    });
  });
});

describe("prepareDetail: values JSON cannot hold as they are", () => {
  it("breaks a loop of objects, marking where it closes", () => {
    const task: Record<string, unknown> = { id: "t1" };
    task.self = task;

    expect(prepareDetail({ task })).toEqual({ task: { id: "t1", self: CIRCULAR } });
  });

  it("breaks a loop back to the detail object itself", () => {
    const detail: Record<string, unknown> = { id: "t1" };
    detail.again = detail;

    expect(prepareDetail(detail)).toEqual({ id: "t1", again: CIRCULAR });
  });

  it("copies the same object twice when it appears side by side, rather than marking it", () => {
    const category = { id: "c1" };
    expect(prepareDetail({ before: category, after: category })).toEqual({
      before: { id: "c1" },
      after: { id: "c1" },
    });
  });

  it("breaks an error whose cause is itself", () => {
    const error = new Error("loops");
    error.cause = error;

    expect(prepareDetail({ error }).error).toMatchObject({ message: "loops", cause: CIRCULAR });
  });

  it("writes a BigInt as its digits", () => {
    expect(prepareDetail({ rows: BigInt("12345678901234567890") })).toEqual({
      rows: "12345678901234567890",
    });
  });

  it("returns something JSON can always serialise", () => {
    const detail: Record<string, unknown> = {
      n: BigInt(1),
      error: new Error("x"),
      at: new Date(0),
    };
    detail.loop = detail;

    expect(() => JSON.stringify(prepareDetail(detail))).not.toThrow();
  });

  it("leaves numbers, booleans, null and dates for JSON to write", () => {
    const at = new Date("2026-11-14T09:00:00.000Z");
    expect(JSON.parse(JSON.stringify(prepareDetail({ n: 2, ok: true, none: null, at })))).toEqual({
      n: 2,
      ok: true,
      none: null,
      at: "2026-11-14T09:00:00.000Z",
    });
  });

  it("leaves the caller's object untouched", () => {
    const detail = { password: "hunter2", nested: { cookie: "a=1" } };
    prepareDetail(detail);

    expect(detail).toEqual({ password: "hunter2", nested: { cookie: "a=1" } });
  });
});
