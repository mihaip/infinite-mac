#!/bin/bash

# Assumes that the Docker image has been built:
# docker build -t macemu_emsdk .

docker run --rm -it \
    -v `realpath macemu`:/macemu \
    -v `realpath minivmac`:/minivmac \
    -v `realpath dingusppc`:/dingusppc \
    -v `realpath previous`:/previous \
    -v `realpath pearpc`:/pearpc \
    --entrypoint bash macemu_emsdk
