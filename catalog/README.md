# Price list goes here

Put ONE price list file in this folder: `.xlsx`, `.csv`, or a `.zip` containing one of those.

Required columns (first row = headers):
MAS Contract, manufacturer, manufacturer_part_number, vendor_part_number, sin,
item_name, item_description, uom, govt_price_with_fee (or Price), country_of_origin, delivery_days,
default_photo (optional: photo file name, matched to img/p/)

When you upload a new file to GitHub, the site rebuilds itself in about 2 minutes.
To update prices: delete the old file, upload the new one.

GitHub's website accepts files up to 25 MB. If the price list is bigger, zip it first.

## Photos
Run `python tools/process_photos.py <folder of original photos>` to convert photos into img/p/,
then commit img/p. Items whose default_photo has no file in img/p show without a photo.
