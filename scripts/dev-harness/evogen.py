#!/usr/bin/env python3
"""Submit an Evolink generation, poll to completion, download the PNG, record the URL.

Usage: evogen.py --out NAME.png --prompt-file PROMPT.txt [--size 16:9] [--quality 1K] [ref_url ...]
Writes manifest lines to manifest.tsv (name<TAB>url) next to the output file.
"""
import argparse, json, os, sys, time, urllib.request

API = "https://api.evolink.ai"


def req(path, payload=None):
    url = API + path
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, headers={
        "Authorization": "Bearer " + os.environ["EVOLINK_API_KEY"],
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.load(resp)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--prompt-file", required=True)
    p.add_argument("--size", default="16:9")
    p.add_argument("--quality", default="1K")
    p.add_argument("--model", default="gemini-3.1-flash-image-preview")
    p.add_argument("refs", nargs="*")
    a = p.parse_args()

    prompt = open(a.prompt_file).read().strip()
    body = {"model": a.model, "prompt": prompt, "size": a.size, "quality": a.quality}
    if a.refs:
        body["image_urls"] = a.refs
    task = req("/v1/images/generations", body)
    tid = task["id"]
    print("task:", tid, file=sys.stderr)

    deadline = time.time() + 300
    while time.time() < deadline:
        time.sleep(4)
        t = req("/v1/tasks/" + tid)
        s = t.get("status")
        if s == "completed":
            url = t["results"][0]
            dl = urllib.request.Request(url, headers={"User-Agent": "curl/8.7.1"})
            with urllib.request.urlopen(dl, timeout=120) as resp:
                open(a.out, "wb").write(resp.read())
            with open(os.path.join(os.path.dirname(os.path.abspath(a.out)) or ".", "manifest.tsv"), "a") as m:
                m.write(f"{os.path.basename(a.out)}\t{url}\n")
            print(url)
            return
        if s == "failed":
            print(json.dumps(t), file=sys.stderr)
            sys.exit(1)
    print("timeout", file=sys.stderr)
    sys.exit(1)


main()
