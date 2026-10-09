# StackEdit

> Full-featured, open-source Markdown editor based on PageDown, the Markdown library used by Stack Overflow and the other Stack Exchange sites.

https://stackedit.io/

This file documents the upstream StackEdit project this fork is based on. See
[README.md](README.md) for how this fork is built, deployed, and maintained as a
static site.

### Ecosystem

- [Chrome app](https://chrome.google.com/webstore/detail/iiooodelglhkcpgbajoejffhijaclcdg)
- Embed StackEdit in any website with [stackedit.js](https://github.com/benweet/stackedit.js)
- [Chrome extension](https://chrome.google.com/webstore/detail/ajehldoplanpchfokmeempkekhnhmoha) that uses stackedit.js
- [Community](https://community.stackedit.io/)

### Build

```bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm start

# build for production with minification
npm run build

# build for production and view the bundle analyzer report
npm run build --report
```

This fork is static-site-only: the production build is a static artifact served
from GitHub Pages, with no server-side component, container image, or Helm chart.
