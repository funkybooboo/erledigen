/** Commitlint: conventional commits + the story linkage (ADR-017).
 *
 * Every commit cites the user story it fulfills in a footer:
 *
 *     Story: HOST-1
 *     Story: USE-2, USE-4   (multiple, comma-separated)
 *
 * The only exemption is the release bump commit (chore(release)) --
 * the release cites every story it ships. */
const STORY_RE = /(^|\n)Story: (USE|HOST|BUILD)-\d+(, (USE|HOST|BUILD)-\d+)*$/;

module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            [
                'feat', // New feature
                'fix', // Bug fix
                'docs', // Documentation only
                'style', // Code style (formatting, no logic change)
                'refactor', // Refactoring (no feat/fix)
                'perf', // Performance improvement
                'test', // Adding tests
                'build', // Build system or dependencies
                'ci', // CI/CD changes
                'chore', // Other changes (tooling, etc.)
                'revert', // Revert previous commit
            ],
        ],
        'subject-case': [2, 'never', ['upper-case']],
        'subject-empty': [2, 'never'],
        'subject-full-stop': [2, 'never', '.'],
        'type-empty': [2, 'never'],
        'footer-story': [2, 'always'],
    },
    plugins: [
        {
            rules: {
                'footer-story': (parsed) => {
                    if (parsed.type === 'chore' && parsed.scope === 'release') {
                        return [true]; // the release commit cites every story it ships
                    }
                    const pass = STORY_RE.test(parsed.footer || '');
                    return [
                        pass,
                        'every commit must cite its story in a "Story: <ID>" footer (USE-/HOST-/BUILD-nn, comma-separated for several) -- nothing is done that does not serve a role (ADR-017)',
                    ];
                },
            },
        },
    ],
};