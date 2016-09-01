<?php

/**
 * @file
 * Ensures ImageCache updates punch through all external caches.
 */

/**
 * Class ImageCachePunchPublicStreamWrapper.
 *
 * Modifies the getExternalUrl to include mtime of imagecache renderings.
 */
class ImageCachePunchPublicStreamWrapper extends DrupalPublicStreamWrapper {

  /**
   * Overrides getExternalUrl().
   *
   * Return the HTML URI of a public file.
   */
  public function getExternalUrl() {
    $target = $this->getTarget();
    if (strpos($target, 'styles/') == 0) {
      $path = str_replace('\\', '/', $target);
      $path = drupal_encode_path($path);

      // Get a base 256 version of our timestamp for a shorter query string.
      $local_path = $this->getLocalPath();
      if (file_exists($local_path)) {
        // This file exists and we can retrieve a last modified time.
        $timestamp = filemtime($local_path);
      }
      else {
        // This may be a new image derivative that has yet to be fully rendered.
        $timestamp = floor(time() / IMAGECACHE_PUNCH_FREQ);
      }

      if ($timestamp) {

        $token_query = array(
          IMAGECACHE_PUNCH_PARAM => $this->shortStamp($timestamp),
        );

        $path .= (strpos($path, '?') !== FALSE ? '&' : '?') .
          drupal_http_build_query($token_query);
      }

      return $GLOBALS['base_url'] . '/' . self::getDirectoryPath() . '/' . $path;
    }
    else {
      return parent::getExternalUrl();
    }
  }

  /**
   * Convert a base 10 timestamp to a base 62.
   *
   * @param int $timestamp
   *   Unix timestamp to convert.
   * @param int $b
   *   Base to convert to.
   *
   * @return string
   *   Returns a short string version of the timestamp.
   */
  private function shortStamp($timestamp, $b = 62) {
    $base = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $r = $timestamp % $b;
    $res = $base[$r];
    $q = floor($timestamp / $b);
    while ($q) {
      $r = $q % $b;
      $q = floor($q / $b);
      $res = $base[$r] . $res;
    }
    return $res;
  }

}
