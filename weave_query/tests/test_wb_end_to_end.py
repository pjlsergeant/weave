import pytest
import wandb

import weave_query
import weave_query as weave
from weave_query import compile, types
from weave_query.graph import ConstNode


# Example of end to end integration test
def test_run_logging(user_by_api_key_in_env):
    run = wandb.init(project="project_exists")
    run.log({"a": 1})
    run.finish()

    summary_node = (
        weave_query.ops.project(run.entity, run.project).run(run.id).summary()["a"]
    )
    summary = weave.use(summary_node)

    assert summary == 1

    is_none_node = weave_query.ops.project(run.entity, run.project).isNone()

    assert weave.use(is_none_node) == False

    is_none_node = weave_query.ops.project(
        run.entity, "project_does_not_exist"
    ).isNone()

    assert weave.use(is_none_node) == True


# Test each of the auth strategies
def test_basic_publish_user_by_api_key_in_context(user_by_api_key_in_context):
    return _test_basic_publish(user_by_api_key_in_context)


def test_basic_publish_user_by_api_key_in_env(user_by_api_key_in_env):
    return _test_basic_publish(user_by_api_key_in_env)


def test_basic_publish_user_by_api_key_netrc(user_by_api_key_netrc):
    return _test_basic_publish(user_by_api_key_netrc)


# As of this writing, I don't have a good way to bootstrap cookies
# def test_basic_publish_user_by_http_headers_in_context(user_by_http_headers_in_context):
#     return _test_basic_publish(user_by_http_headers_in_context)


# def test_basic_publish_user_by_http_headers_in_env(user_by_http_headers_in_env):
#     return _test_basic_publish(user_by_http_headers_in_env)


def _test_basic_publish(user_fixture):
    ref = weave.storage.publish([1, 2, 3], "weave/list")
    # Getting the ref for `a` is not a final API. Expect
    # that changes to the publish flow will bread this test
    # and you might need to update how you get the ref.
    uri = ref.uri
    assert (
        uri
        == f"wandb-artifact:///{user_fixture.username}/weave/list:0cdf3358dc939f961ca9/obj"
    )
    assert weave_query.ref_base.Ref.from_str(uri).get() == [1, 2, 3]


class TestRunHistories:
    def test_basic(self, user_by_api_key_in_env):
        run = wandb.init(project="project_exists")
        run.log({"a": 1})
        run.finish()

        history_node = (
            weave_query.ops.project(run.entity, run.project)
            .runs()
            .history()
            .concat()["a"]
        )
        history = weave.use(history_node)
        assert history == [1]

    @pytest.mark.skip(reason="Occasionally returns [1, 2] instead of [2, 1]")
    def test_multiple_runs(self, user_by_api_key_in_env):
        run = wandb.init(project="project_exists")
        run.log({"a": 1})
        run.finish()

        run = wandb.init(project="project_exists")
        run.log({"a": 2})
        run.finish()

        history_node = (
            weave_query.ops.project(run.entity, run.project)
            .runs()
            .history()
            .concat()["a"]
        )
        history = weave.use(history_node)

        # Runs return in reverse chronological order
        assert history == [2, 1]

    def test_with_logged_nested_dict(self, user_by_api_key_in_env):
        run = wandb.init(project="project_exists")
        run.log({"nested_dictionary": {"key_0": 0}})
        run.finish()

        key = ConstNode(types.String(), "nested_dictionary\\.key_0")
        history_node = (
            weave_query.ops.project(run.entity, run.project)
            .filteredRuns("{}", "-createdAt")
            .limit(100)
            .index(0)
            .history()
            .pick(key)
        )

        history = weave.use(history_node)
        assert history == [0]


# Example of end to end integration test
def test_run_history_count(user_by_api_key_in_env, cache_mode_minimal):
    run = wandb.init(project="project_exists")
    run.log({"a": 1})
    run.log({"a": 2})
    run.finish()

    run_node = weave_query.ops.project(run.entity, run.project).run(run.id)
    h_count_node = run_node.history().count()
    history_count = weave.use(h_count_node)
    assert history_count == 2

    compiled = compile.compile([h_count_node])
    assert compiled[0].from_op.name == "run-historyLineCount"

    run_history_lines = weave.use(run_node.historyLineCount())
    assert run_history_lines == 2
