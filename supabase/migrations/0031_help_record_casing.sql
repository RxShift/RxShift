-- Uniform naming: capitalize the "Compliance Record" proper noun across all help
-- articles. Case-sensitive replace of the lowercase phrase (and its plural),
-- so already-capitalized text and unrelated words (compliance logic/warning) are
-- untouched. Slugs (hyphenated) are unaffected.

update help_article
set body_markdown = replace(body_markdown, 'compliance record', 'Compliance Record'),
    updated_at = now()
where body_markdown ~ 'compliance record';
