#!/bin/bash
set -e

echo "Building emulators inside Docker container."

source /emsdk/emsdk_env.sh

# Basilisk II
echo "Building Basilisk II..."
cd /macemu/BasiliskII/src/Unix
make clean
./_embootstrap.sh
./_emconfigure.sh
make -j8
echo "✓ Basilisk II built successfully"

# SheepShaver
echo "Building SheepShaver..."
cd /macemu/SheepShaver/src/Unix
make clean
./_emconfigure.sh
make -j8
echo "✓ SheepShaver built successfully"

# Mini vMac variants
echo "Building Mini vMac variants..."
cd /minivmac
declare -a MINIVMAC_VARIANTS=(
    "Plus:"
    "128K:-m 128K -speed z"
    "512Ke:-m 512Ke"
    "SE:-m SE"
    "II:-m II"
    "IIx:-m IIx -mem 32M"
)
for variant in "${MINIVMAC_VARIANTS[@]}"; do
    name="${variant%%:*}"
    args="${variant#*:}"

    echo "Building Mini vMac - Mac ${name}..."
    if [ -z "$args" ]; then
        ./emscripten_setup.sh
    else
        ./emscripten_setup.sh $args
    fi
    make -j8
    echo "✓ Mini vMac ${name} built successfully"
done

# DingusPPC
echo "Building DingusPPC.."
cd /dingusppc
rm -rf build
mkdir -p build
cd build
emcmake cmake -DCMAKE_BUILD_TYPE=Release ..
make dingusppc -j8
echo "✓ DingusPPC built successfully"

# Previous
echo "Building Previous"
cd /previous
rm -rf build
mkdir -p build
cd build
emcmake cmake -DCMAKE_BUILD_TYPE=Release -DENABLE_RENDERING_THREAD=0 ..
make previous -j8
echo "✓ Previous built successfully"

# PearPC
echo "Building PearPC"
cd /pearpc
make clean
./_emconfigure.sh
make -j8
echo "✓ PearPC built successfully"

echo "✓ All emulators built successfully!"
