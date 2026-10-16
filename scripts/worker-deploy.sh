#!/bin/bash

npm run --silent ts:types && \
    npm run --silent py:types && \
    CLOUDFLARE_ENV=production vp build && \
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
