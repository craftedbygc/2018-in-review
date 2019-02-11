<?php

function getDirContents($dir, &$results = array()){
    $files = scandir($dir);

    foreach($files as $key => $value){
        $path = $dir.DIRECTORY_SEPARATOR.$value;
        if(!is_dir($path) && $value !== '.DS_Store') {
            $results[] = $value;
        } else if($value != "." && $value != ".." && $value !== '.DS_Store') {
            getDirContents($path, $results[$value]);
        }
    }

    return $results;
}

$assets = getDirContents('public/assets');
$monthAssets = $assets;
unset( $monthAssets['intro'] );
unset( $monthAssets['end'] );
// ksort( $monthAssets );

uksort($monthAssets, "compare_months");

function compare_months($a, $b) {
    $monthA = date_parse($a);
    $monthB = date_parse($b);

    return $monthA["month"] - $monthB["month"];
}

$json = 'const assets = ' . json_encode( $assets ) . '; export default assets;';
$json_pretty = json_encode( $monthAssets, JSON_PRETTY_PRINT );

file_put_contents( 'src/assets.js', $json );

file_put_contents( 'src/assetDataGenerated.json', $json_pretty );