/**
 * This component is used to display the status values in the filter bar.
 */

import _ from 'lodash';
import React from 'react';

import {FILTER_TO_STATUS, StatusChip} from '../pages/common/StatusChip';

type FilterTagStatusProps = {
  value: string | string[];
};

export const FilterTagStatus = ({value}: FilterTagStatusProps) => {
  const enabled = _.isArray(value) ? value : value.split(',');
  return (
    <div className="night-aware flex gap-2">
      {Object.keys(FILTER_TO_STATUS).map(status => {
        const isEnabled = enabled.includes(status);
        if (isEnabled) {
          return (
            <StatusChip
              key={status}
              value={FILTER_TO_STATUS[status]}
              iconOnly
            />
          );
        }
        return null;
      })}
    </div>
  );
};
