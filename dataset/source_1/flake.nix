{
  description = "A very basic flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" ];
    in
      {
        devShells = nixpkgs.lib.genAttrs systems (
          system:
          let
            pkgs = import nixpkgs { inherit system; };
          in
            {
              default = pkgs.mkShell {
                name = "smart_sw_shell";

                packages = [
                  pkgs.bun
                  pkgs.typescript-language-server
                ];
              };
            }
        );
  };
}
