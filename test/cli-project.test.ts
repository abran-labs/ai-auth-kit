import { expect, test } from "bun:test";
import {
  inCliSandbox,
  pathExists,
  projectConfigPath,
  projectSecretsPath,
  runCli,
} from "./cli-test-helpers.js";

test("Given an isolated project, when the public CLI initializes, lists, selects, and diagnoses, then every command observes the same project state", async () => {
  await inCliSandbox(async (sandbox) => {
    const path = await runCli(sandbox, ["path", "--project", "alpha"]);
    expect(path).toEqual({ exitCode: 0, stderr: "", stdout: `${projectConfigPath(sandbox, "alpha")}\n` });

    const initialized = await runCli(sandbox, ["init", "-p", "alpha"]);
    expect(initialized.exitCode).toBe(0);
    expect(initialized.stdout).toContain(`Initialized ${projectConfigPath(sandbox, "alpha")}`);
    expect(await pathExists(projectConfigPath(sandbox, "alpha"))).toBe(true);

    const providers = await runCli(sandbox, ["providers", "--project", "alpha"]);
    expect(providers.exitCode).toBe(0);
    expect(providers.stdout).toContain("openai\tOpenAI\tapi-key,oauth-external,env\n");

    const models = await runCli(sandbox, ["models", "openai", "--project", "alpha"]);
    expect(models.exitCode).toBe(0);
    expect(models.stdout).toContain("gpt-5.5\t");

    const selected = await runCli(sandbox, ["use", "openai", "gpt-5.5", "-p", "alpha"]);
    expect(selected.exitCode).toBe(0);
    expect(selected.stdout).toContain("Selected openai/gpt-5.5");

    expect(await runCli(sandbox, ["current", "--project", "alpha"])).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: "openai/gpt-5.5\n",
    });
    expect(await runCli(sandbox, ["current"])).toEqual({ exitCode: 1, stderr: "", stdout: "No model selected\n" });

    const doctor = await runCli(sandbox, ["doctor", "-p", "alpha"]);
    expect(doctor.exitCode).toBe(0);
    expect(doctor.stdout).toContain("project=alpha\n");
    expect(doctor.stdout).toContain("credentials=0\n");
    expect(doctor.stdout).toContain("selected=openai/gpt-5.5\n");
    expect(doctor.stdout).toContain(`config=${projectConfigPath(sandbox, "alpha")}\n`);
  });
});

test("Given malformed project flags, when isolated public CLI processes every missing value form, then it returns the canonical nonzero message", async () => {
  await inCliSandbox(async (sandbox) => {
    const malformed = [
      ["path", "--project"], ["path", "-p"], ["path", "--project", "--help"],
      ["path", "-p", "--help"], ["path", "--project", ""], ["path", "-p", ""],
    ] as const;
    for (const args of malformed) {
      expect(await runCli(sandbox, args)).toEqual({
        exitCode: 1,
        stderr: "Missing value for --project\n",
        stdout: "",
      });
    }
  });
});

test("Given a prompted API-key login, when Ctrl-C declines it, then the CLI cancels without creating credential state", async () => {
  await inCliSandbox(async (sandbox) => {
    const result = await runCli(sandbox, ["login", "openai", "--project", "cancelled"], "\u0003");
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Cancelled");
    expect(result.stderr).toBe("");
    expect(await pathExists(projectConfigPath(sandbox, "cancelled"))).toBe(false);
    expect(await pathExists(projectSecretsPath(sandbox, "cancelled"))).toBe(false);
  });
});
