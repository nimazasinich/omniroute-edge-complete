# PC migration note

This package is prepared for the Windows PC copy of the project.

- `node_modules` is not included; restore Windows-native dependencies with `npm ci`.
- No private `.env` is included. `START-LOCAL-PC.cmd` creates one from `.env.example`.
- `OMNIROUTE_ORIGIN` is blank by default so local snapshot mode does not repeatedly probe `127.0.0.1:20128`.
- Both requested SQLite databases are included and verified.
- Do not replace the databases with empty files.
