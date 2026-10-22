# New Century Technologies Inc — website

Static site (HTML/CSS/JS) hosted on GitHub Pages. Quote form submits through Formspree.

## GSA Products catalog
- Put the price list (.xlsx, .csv, or .zip) in the `catalog/` folder. See `catalog/README.md`.
- On every upload to `main`, GitHub builds the catalog data and publishes the site
  (`.github/workflows/deploy.yml`). Takes about 2 minutes.
- One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

## Test on your computer
    python tools/build_catalog.py catalog/<your price list file>
    python -m http.server 8000
Then open http://localhost:8000/products.html
(pip install openpyxl first if the price list is .xlsx)
