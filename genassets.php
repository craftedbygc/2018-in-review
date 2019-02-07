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

print_r( $assets );

echo json_encode( $assets );