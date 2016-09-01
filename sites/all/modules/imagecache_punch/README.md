ImageCache Punch
----------------

Problems:

1) New Images do not show up.
   This can happen if it takes too long for ImageCache to resize or render
   a large image, external caching may store an error page,
   or an incomplete blob of data. Depending on how the external caching is
   configured this might solve itself in time. In some cases it won't.
2) Image changes do not show up.
   The user uploads a new version of an image, or sets cropping/focus.
   The names of images do not change by default in these cases,
   so the server may be telling the external caching (and end-user's
   browser) to hold on to the image for an extended period (which is good).
   This can cause a lot of frustration, particularly for content editors,
   who may be the only users incapable of seeing their changes.

Solutions:

1) Adds a "t" parameter to all images, based on the time the image was last
   modified. This ensures that any change is seen by everyone as soon as the 
   page is reloaded. This includes focus changes, crop changes, or other 
   changes that are not tracked directly by image styles internally.
2) Assumes a rounded "t" parameter to images you have uploaded/altered recently.
   This helps to ensure that ImageCache has the time it needs to re-render
   images, even if multiple loads are needed. This drastically reduces
   the likelihood of erroneous external caching.
