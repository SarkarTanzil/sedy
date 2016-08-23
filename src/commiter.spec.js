import sinon from 'sinon';
import commiterFactory from './commiter';
import { assert } from 'chai';

describe('Commiter', () => {
    let config;
    let git;
    let githubApi;
    let parsedContent;
    let fixedContent;

    beforeEach(() => {
        git = {
            checkout: sinon.spy(content => callback => callback(null, null)),
            add: sinon.spy(content => callback => callback(null, null)),
            commit: sinon.spy(content => callback => callback(null, { sha: 'commit sha' })),
            push: sinon.spy(content => callback => callback(null, null)),
            commitAuthor: { name: 'marmelab-bot' },
        };
        githubApi = {
            replyToPullRequestReviewComment: sinon.spy(content => callback => callback(null, null)),
        };
        parsedContent = {
            repository: { user: 'marmelab', name: 'sedy' },
            comment: {
                id: 42,
                sender: 'username',
                createdDate: new Date(),
                url: 'http://perdu.com',
                path: 'folder/to/blob.txt',
            },
            pullRequest: { number: 1, ref: 'branch-name' },
        };
        fixedContent = [{
            blob: { content: 'old blob content' },
            content: 'new blob content',
        }];
    });

    describe('workflow', () => {
        it('should warn the comment author if no fix found', function* () {
            const commiter = commiterFactory(null, githubApi, git);
            const result = yield commiter.commit(parsedContent, null);

            assert.deepEqual(result, false);
            assert.deepEqual(githubApi.replyToPullRequestReviewComment.getCall(0).args, [{
                repoUser: 'marmelab',
                repoName: 'sedy',
                pullRequestNumber: 1,
                commentId: 42,
                message: ':confused: @username, I did not understand the request.',
            }]);
        });

        it('should checkout to the related branch', function* () {
            const commiter = commiterFactory(null, githubApi, git);
            yield commiter.commit(parsedContent, fixedContent);

            assert.deepEqual(git.checkout.getCall(0).args[0], 'branch-name');
        });

        it('should add a new blob head', function* () {
            const commiter = commiterFactory(null, githubApi, git);
            yield commiter.commit(parsedContent, fixedContent);

            assert.deepEqual(git.add.getCall(0).args, [{
                content: 'new blob content',
                mode: '100644',
            }, '/folder/to/blob.txt']);
        });

        it('shoud create a commit', function* () {
            const commiter = commiterFactory(null, githubApi, git);
            yield commiter.commit(parsedContent, fixedContent);

            assert.deepEqual(git.commit.getCall(0).args, ['branch-name', `Typo fix authored by username

marmelab-bot is configured to automatically commit change authored by specific syntax in a comment.
See the trigger at http://perdu.com`,
            ]);
        });

        it('should push to the related branch', function* () {
            const commiter = commiterFactory(null, githubApi, git);
            yield commiter.commit(parsedContent, fixedContent);

            assert.deepEqual(git.push.getCall(0).args, ['branch-name']);
        });

        it('should warn the author that the commit is pushed', function* () {
            const commiter = commiterFactory(null, githubApi, git);
            const result = yield commiter.commit(parsedContent, fixedContent);

            assert.deepEqual(result, true);
            assert.deepEqual(githubApi.replyToPullRequestReviewComment.getCall(0).args, [{
                repoUser: 'marmelab',
                repoName: 'sedy',
                pullRequestNumber: 1,
                commentId: 42,
                message: ':white_check_mark: @username, check out my commits!\nI have fixed your typo(s) at commit sha',
            }]);
        });
    });

    describe('security', () => {
        it('should warn the author if an occured while commiting', function* () {
            const commiter = commiterFactory(null, githubApi, git);
            const result = yield commiter.commit(parsedContent, { missing: 'value' });

            assert.deepEqual(result, false);
            assert.deepEqual(githubApi.replyToPullRequestReviewComment.getCall(0).args, [{
                repoUser: 'marmelab',
                repoName: 'sedy',
                pullRequestNumber: 1,
                commentId: 42,
                message: ':warning: @username, an error occured.\nBe sure to check all my commits!',
            }]);
        });
    });
});
