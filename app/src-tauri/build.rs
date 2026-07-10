use std::{env, fs, path::PathBuf};

fn main() {
    ensure_generated_genteel_placeholder();
    tauri_build::build()
}

fn ensure_generated_genteel_placeholder() {
    let generated = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap_or_default())
        .join("generated")
        .join("genteel");
    if generated.is_file() {
        return;
    }
    if let Some(parent) = generated.parent() {
        fs::create_dir_all(parent).expect("could not create generated resource directory");
    }
    fs::write(
        &generated,
        b"#!/bin/sh\necho 'Run the Drive16 Tauri build preparation step.' >&2\nexit 1\n",
    )
    .expect("could not create generated Genteel placeholder");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&generated, fs::Permissions::from_mode(0o755))
            .expect("could not mark generated Genteel placeholder executable");
    }
}
