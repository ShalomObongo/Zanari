# Copilot Terminal Execution Instructions

These rules are mandatory and must be followed exactly when generating or running terminal commands.

- Always run commands from an explicit absolute directory. Every command must be prefixed with a directory change using the absolute path, and the command itself. Use `&&` so the command runs only if `cd` succeeds:
    - Example: `cd /full/path/to/directory && <command>`
- Never use relative paths, `~`, or shell variables in place of the absolute path when executing a command.
- For multiple commands in the same working directory, combine them after a single `cd`:
    - Example: `cd /full/path/to/directory && command1 && command2`
- Before proposing or running any command, detect active processes or jobs that could be affected:
    - Check for shell jobs: `jobs -p`
    - Check for matching processes: `pgrep -f "<pattern>"` or `ps aux | grep "<pattern>"`
- If other commands or processes are running that might be interrupted or affected, do NOT proceed. Instead:
    - Run the command in a separate session that does not interfere with the running process.
- Always include a one-line comment explaining the intent of the command before the command itself.
    - Example:
        - `# Intent: run migration in project directory`
        - `cd /full/path/to/directory && ./migrate.sh`
- Treat interruption of other commands as unacceptable unless the user explicitly instructs that interruption is intended.
- Be explicit and conservative: when in doubt, ask for clarification rather than taking action.

These instructions are strict. Follow them verbatim.