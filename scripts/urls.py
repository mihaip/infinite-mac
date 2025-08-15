import bs4
import hashlib
import json
import os
import paths
import ssl
import sys
import urllib.request
import typing


def read_url(url: str, on_cache_miss: typing.Callable[[], None] = None) -> bytes:
    cache_path = read_url_to_path(url, on_cache_miss=on_cache_miss)
    return open(cache_path, "rb").read()


def read_url_headers(url: str) -> dict:
    cache_path = read_url_to_path(url, headers=True)
    with open(cache_path, "r") as f:
        return json.load(f)


def read_url_to_path(
    url: str, headers: bool = False, on_cache_miss: typing.Callable[[], None] = None
) -> str:
    os.makedirs(paths.CACHE_DIR, exist_ok=True)
    cache_key = hashlib.sha256(url.encode()).hexdigest()
    if headers:
        cache_key += "-headers"
    cache_path = os.path.join(paths.CACHE_DIR, cache_key)

    # Preserve the filename in the cached version for .gzip, otherwise unar
    # will name the extracted file after the cache key.
    if url.endswith(".gz") or url.endswith(".tgz"):
        filename = url.split("/")[-1]
        cache_dir = cache_path + "-dir"
        os.makedirs(cache_dir, exist_ok=True)
        cache_path = os.path.join(cache_dir, filename)

    if not os.path.exists(cache_path):
        if on_cache_miss:
            on_cache_miss()
        if url.startswith("https://macgui.com/downloads/"):
            contents = fetch_macgui_url(url, headers)
        else:
            contents = fetch_url(url, headers)
        with open(cache_path, "wb+") as f:
            f.write(contents)

    return cache_path


def fetch_url(url: str, headers: bool = False) -> bytes:
    try:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        request = urllib.request.Request(
            url,
            method="HEAD" if headers else "GET",
            data=None,
            headers={"User-Agent": "Infinite Mac (+https://infinitemac.org)"},
        )
        response = urllib.request.urlopen(request, context=context)
        if headers:
            return json.dumps(dict(response.headers)).encode()
        return response.read()
    except:
        sys.stderr.write("Failed to download %s\n" % url)
        raise


# macgui.com has a nonce in the download URL, so we need to fetch the page first
# to get it, and then do the download.
def fetch_macgui_url(page_url: str, headers: bool = False) -> str:
    page_body = fetch_url(page_url)
    soup = bs4.BeautifulSoup(page_body, "html.parser")
    download_link = soup.find("a", {"title": "Download File"})
    if download_link:
        download_url = urllib.parse.urljoin(page_url, download_link.get("href"))
        return fetch_url(download_url, headers)
    else:
        raise Exception("Could not find download link on page %s" % page_url)
