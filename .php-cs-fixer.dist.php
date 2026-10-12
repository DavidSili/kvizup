<?php

$finder = PhpCsFixer\Finder::create()
    ->in(__DIR__)
    ->exclude(['node_modules', 'temp_files']);

return (new PhpCsFixer\Config())
    ->setRules([
        '@PSR12' => true,
        'array_indentation' => true,
        'statement_indentation' => true,
        'binary_operator_spaces' => ['default' => 'single_space'],
        'cast_spaces' => ['space' => 'single'],
        'no_extra_blank_lines' => ['tokens' => ['extra', 'square_brace_block']],
        'trailing_comma_in_multiline' => ['elements' => ['arrays']],
    ])
    ->setFinder($finder);
