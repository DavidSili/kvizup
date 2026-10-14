<?php

require __DIR__ . '/../admin/lib.php';
require __DIR__ . '/../admin/ai.php';

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$proposal = ['description' => 'Opis', 'cards' => [], 'questions' => [], 'warnings' => []];
$kinds = ['classification', 'matching', 'number', 'timeline', 'true-false'];
foreach ($kinds as $kind) {
    for ($i = 0; $i < 3; $i++) {
        $proposal['questions'][] = ['kind' => $kind, 'topic' => 'Tema', 'prompt' => "Pitanje $kind $i",
            'answer' => $kind === 'true-false' ? 'Tačno' : 'A',
            'choices' => $kind === 'true-false' ? ['Tačno', 'Netačno'] : ['A', 'B', 'C']];
    }
}
$result = proposal_to_chapter($proposal, 'lesson', 'Lekcija', $kinds);
$chapter = $result['chapter'];
check(count($chapter['activities']) === 5, 'Each selected challenge must have an activity');
foreach ($chapter['activities'] as $activity) {
    check(count($chapter[$activity['itemSet']]) === 3, 'Challenge bank must contain its own questions');
    check($activity['questionCount'] === 3, 'Question count must fit the bank');
    check(count($activity['itemIds']) === 3, 'Activity must reference all challenge questions');
}
check($chapter['questions'] === [], 'Specialized questions must not leak into the mixed bank');
$onlyNumbers = proposal_to_chapter($proposal, 'lesson', 'Lekcija', ['number']);
check(count($onlyNumbers['chapter']['activities']) === 1, 'Unselected challenges must not be created');
check(!isset($onlyNumbers['chapter']['matchingQuestions']), 'Unselected banks must not be imported');
$small = $proposal;
$small['questions'] = array_slice($proposal['questions'], 0, 2);
$result = proposal_to_chapter($small, 'lesson', 'Lekcija', ['classification']);
check(!$result['chapter']['activities'] && count($result['warnings']) === 1, 'Insufficient material must warn and omit the challenge');
$invalid = $small;
$invalid['questions'][0]['answer'] = 'Missing';
try {
    proposal_to_chapter($invalid, 'lesson', 'Lekcija', ['classification']);
    throw new RuntimeException('Invalid answer accepted in a small bank');
} catch (InvalidArgumentException $expected) {
}
$invalid['questions'][0]['kind'] = 'true-false';
try {
    proposal_to_chapter($invalid, 'lesson', 'Lekcija', ['true-false']);
    throw new RuntimeException('Invalid binary options accepted');
} catch (InvalidArgumentException $expected) {
}
foreach (glob(__DIR__ . '/../data/subjects/*.json') as $file) {
    validate_subject(json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR));
}
echo "PASS: five challenge types, selections, references, insufficient material, invalid answers and existing subjects.\n";
