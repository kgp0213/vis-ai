fn main() {
    tauri_build::build();
    println!("cargo:rerun-if-changed=../src");
    println!("cargo:rerun-if-changed=src/loading.html");
}
