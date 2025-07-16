# StackEdit Serverless
> A serverless version of [StackEdit](https://github.com/benweet/stackedit)

https://privapps.github.io/stackedit-serverless

## Why
The last update for [stackedit](https://github.com/benweet/stackedit) was March 2021, and lots of PR were in limbo and not merged. I had a strong feeling that this project might not accessible soon since maintaining a website has expenses. Also, there is a StackEditPro around without source code available, which makes me feel the need to have one up and running in case of losing it.

## What
This is a fork of StackEdit v5.14.10 . Since I do not have any funding, this project only keeps the UI part of it and is stripped of the server-side. And due to that, the integration with Google Drive, Github, Gitlab, etc. was not functioning anymore, so I hide those from the menu.

## Benefit 
* Use it offline 100%
* Can backup single notes or the entire workspace to a file, encrypt and save to any cloud as you like (Use your encryption software method as you wish). This maximizes privacy and security.
* Minimum cost since they are all static pages

## How
Here are ways you can use it
1. Use the Github page https://privapps.github.io/stackedit-serverless
2. Local Web Service e.g. \
```bash
curl -skL https://github.com/privapps/stackedit-serverless/tarball/gh-pages -o ses.tar.gz
tar xf ses.tar.gz ; cd <folder with docs>
python3 -m http.server 8010
```
3. Within a Docker container \
```docker run -it -p 8010:8010 -v /<path>/docs:/html busybox httpd -fp 8010 -h html```

## Build
**Requirements:**
- Node.js >= 20.x
- npm >= 9.x

The project now uses modern dependencies and build tools. See the updated GitHub Actions workflow for reference.

For some reason, I have difficulty building it. Missing dependencies on Mac ARM, etc. Currently, the source code is built using npm within Alpine 3.14. See GitHub actions.

## Limitation
* Due to missing the server-side, integration with third-party applications is stripped.
* Missing the note search :(

## Credit
* [StackEdit](https://github.com/benweet/stackedit)
* [StackEdit Docker](https://github.com/qdm12/stackedit-docker)