FROM ghcr.io/mihaip/emscripten-devcontainer:2.0.34
RUN apt update && apt install -y autoconf libsdl1.2-dev wget lzip
COPY macemu/BasiliskII/src/Unix/_em_build_mpfr.sh /tmp/_em_build_mpfr.sh
RUN /tmp/_em_build_mpfr.sh