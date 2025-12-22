FROM ubuntu:24.04

RUN apt update && apt install -y \
    python3 cmake git build-essential \
    autoconf libsdl1.2-dev libsdl2-dev wget lzip curl yacc

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

# Emscripten has separate arm64 vs. x86-64 Docker images, so to simplify things
# install the SDK manually.
RUN git clone https://github.com/emscripten-core/emsdk.git \
    && cd emsdk \
    && ./emsdk install 4.0.22 \
    && ./emsdk activate 4.0.22 \
    && echo "source $(pwd)/emsdk_env.sh" >> $HOME/.bashrc

COPY macemu/BasiliskII/src/Unix/_em_build_mpfr.sh /tmp/_em_build_mpfr.sh
RUN /tmp/_em_build_mpfr.sh
