#!/bin/bash

# Assumes that rclone is installed and access token with Object Read & Write
# permissions is configured.

echo "Syncing disk chunks to Cloudflare R2…"
TIMEFORMAT='Synced disk chunks to Cloudflare R2: %R'
time {
    rclone \
        --config=scripts/rclone.conf \
        sync \
        --progress \
        --fast-list \
        --no-update-modtime \
        --size-only \
        --transfers 32 \
        --checkers 32 \
        public/Disk \
        cf:infinite-mac-disk
}
