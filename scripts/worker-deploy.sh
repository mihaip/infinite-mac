#!/bin/bash

tsc --noEmit && \
    tsc --noEmit --project worker/tsconfig.json && \
    CLOUDFLARE_ENV=production vite build && \
    wrangler deploy && \
    rclone \
        --config=scripts/rclone.conf \
        sync \
        --progress \
        --fast-list \
        --s3-no-check-bucket \
        --no-update-modtime \
        --size-only \
        CD-ROMs/build/media \
        cf:infinite-mac-disk/media
