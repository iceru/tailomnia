<?php

add_action('init', function () {
    register_post_type('car', [
        'labels' => [
            'name' => __('Cars'),
            'singular_name' => __('Car'),
        ],

        'public' => true,
        'has_archive' => true,
        'show_in_rest' => true,

        'supports' => [
            'title',
            'editor',
            'thumbnail',
        ],
    ]);
});
