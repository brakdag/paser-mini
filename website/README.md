# Project website

Static HTML and CSS for https://brakdag.github.io/paser-mini/.
No build step, JavaScript, external fonts or runtime dependencies.

Preview from the repository root:

```sh
python3 -m http.server 8000 --directory website
```

Open http://localhost:8000/ in a browser.

The `Publish website` workflow deploys this directory when changes to `website/`
or its workflow reach `main`. It also supports manual runs from the Actions tab.
In repository Settings → Pages, the publishing source must be GitHub Actions.
Only this directory is uploaded; application code and private configuration are
not part of the website artifact.
