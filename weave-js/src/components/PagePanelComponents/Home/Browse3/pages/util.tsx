import _ from 'lodash';
import {useEffect, useMemo, useState} from 'react';
import {useLocation} from 'react-router-dom';

import {useDeepMemo} from '../../../../../hookUtils';

export const useURLSearchParamsDict = () => {
  const {search} = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(search);
    const entries = Array.from(params.entries());
    const searchDict = _.fromPairs(entries);
    return searchDict;
  }, [search]);
};

/**
 * A hook that returns a state that can be controlled by an external component.
 * The usage is the same as useState, but with an additional optional parameter
 * that allows the state to be controlled by an external component.
 *
 * This pattern makes it easy to create components that can be controlled by an external
 * component, but also have a default state if the external component does not provide
 * a state.
 */
export const useControllableState = <T,>(
  controlledOrInitialState: T,
  controllingSetState?: (state: T) => void
): [T, (state: T) => void] => {
  const isControlled = controllingSetState !== undefined;

  // Initialize inner state and setState functions
  const [innerState, innerSetState] = useState<T>(controlledOrInitialState);

  // Update inner state if deepState changes (react to external changes)
  const deepState = useDeepMemo(controlledOrInitialState);
  useEffect(() => {
    innerSetState(deepState);
  }, [deepState]);

  // If we are controlled, use propsState as state and propOnStateUpdate as setState,
  // otherwise use innerState and innerSetState
  const state = useMemo(
    () => (isControlled ? controlledOrInitialState : innerState),
    [isControlled, controlledOrInitialState, innerState]
  );
  const setState = useMemo(
    () => (isControlled ? controllingSetState : innerSetState),
    [isControlled, controllingSetState]
  );

  return [state, setState];
};
