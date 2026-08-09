# Running the Tailomnia CLI

## Setup

Tailomnia uses pnpm and currently requires Node.js, PHP, and Composer. Install the JavaScript dependencies from the repository root:

```sh
pnpm install
```

The `create` command also requires the TailPress installer. If `tailpress` is not available, the CLI will offer to install it globally with Composer.

WP-CLI (`wp`) is required when you answer **Yes** to **Install WordPress as well?**. If it is missing, Tailomnia offers to install it and verifies that the command is available before continuing. It prefers Homebrew when `brew` is available and disables auto-update for that install so unrelated third-party taps are not loaded. Tailomnia never changes Homebrew tap trust settings. If Homebrew fails, it offers Composer as a fallback with dependency updates enabled.

Tailomnia gives its WP-CLI installation subprocesses a 512 MB PHP memory limit. This is scoped to those subprocesses and does not modify the system `php.ini`.

The WordPress database name, user, host, site URL, site title, admin username, and admin email prompts are prefilled with defaults. Press Enter to accept each one. Password fields are not prefilled.

The default database host is `127.0.0.1` so PHP connects over TCP. This avoids the common macOS `No such file or directory` error caused by `localhost` resolving to a MySQL Unix socket at a different path.

If Tailomnia cannot reach a local database, it checks for a Homebrew installation of MySQL or MariaDB and asks permission to start it. If neither is installed, it offers to install and start MySQL. Tailomnia does not attempt to manage a remote database server.

You can also install and verify it manually on macOS with Homebrew:

```sh
brew install wp-cli
wp --info
```

After `wp --info` succeeds, run `tailomnia create` again. Answer **No** to the WordPress prompt if you only want Tailomnia to create the TailPress theme and do not need a full WordPress installation.

## Run from source

During development, pass CLI arguments after `--`:

```sh
pnpm dev -- --help
pnpm dev -- create my-project
pnpm dev -- make:cpt
```

- `create [name]` creates a new TailPress project. Run it from the directory where the new project directory should be created. Omitting the name opens a prompt.
- `make:cpt` generates a custom post type and ACF field group interactively. Run it from the TailPress theme directory that should receive the generated files.

## Run the built CLI

Build the TypeScript source:

```sh
pnpm build
```

Then run the compiled entry point directly:

```sh
node dist/cli.js --help
node dist/cli.js create my-project
node dist/cli.js make:cpt
```

To expose the `tailomnia` command globally from this local checkout, link the package after building:

```sh
pnpm setup
source ~/.zshrc
pnpm link --global
tailomnia --help
tailomnia create my-project
tailomnia make:cpt
```

`pnpm setup` creates pnpm's global binary directory, adds `PNPM_HOME` to your shell configuration, and puts it on `PATH`. On macOS with zsh, reload `~/.zshrc` as shown above (or open a new terminal) before running `pnpm link --global`.

If `pnpm link --global` reports `ERR_PNPM_NO_GLOBAL_BIN_DIR`, confirm that the setup is visible to the current shell:

```sh
echo "$PNPM_HOME"
pnpm bin --global
```

Both should print the pnpm global binary directory. Then run the build and link again:

```sh
pnpm build
pnpm link --global
tailomnia --help
```

You do not need global linking to use the CLI. From this repository, you can always run:

```sh
pnpm dev -- --help
```

Re-run `pnpm build` after changing the TypeScript source when using the linked command.
