import {
  Dialog,
  DialogActions as MaterialDialogActions,
  DialogContent as MaterialDialogContent,
  DialogTitle as MaterialDialogTitle,
} from '@material-ui/core';
import {PopupDropdown} from '@wandb/weave/common/components/PopupDropdown';
import {useOrgName} from '@wandb/weave/common/hooks/useOrganization';
import {useViewerUserInfo2} from '@wandb/weave/common/hooks/useViewerUserInfo';
import {Button} from '@wandb/weave/components/Button';
import {
  IconDelete,
  IconPencilEdit,
  IconTable,
} from '@wandb/weave/components/Icon';
import {maybePluralizeWord} from '@wandb/weave/core/util/string';
import React, {FC, useState} from 'react';
import styled from 'styled-components';

import * as userEvents from '../../../../../../integrations/analytics/userEvents';
import {useClosePeek} from '../../context';
import {AddToDatasetDrawer} from '../../datasets/AddToDatasetDrawer';
import {isEvaluateOp} from '../common/heuristics';
import {CopyableId} from '../common/Id';
import {useWFHooks} from '../wfReactInterface/context';
import {CallSchema} from '../wfReactInterface/wfDataModelHooksInterface';

export const OverflowMenu: FC<{
  selectedCalls: CallSchema[];
  setIsRenaming: (isEditing: boolean) => void;
}> = ({selectedCalls, setIsRenaming}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addToDatasetModalOpen, setAddToDatasetModalOpen] = useState(false);

  const menuOptions = [
    [
      {
        key: 'rename',
        text: 'Rename',
        icon: <IconPencilEdit style={{marginRight: '4px'}} />,
        onClick: () => setIsRenaming(true),
        disabled: selectedCalls.length !== 1,
      },
    ],
    [
      {
        key: 'addToDataset',
        text: 'Add to dataset',
        icon: <IconTable style={{marginRight: '4px'}} />,
        onClick: () => setAddToDatasetModalOpen(true),
        disabled: selectedCalls.length === 0,
      },
    ],
    [
      {
        key: 'delete',
        text: 'Delete',
        icon: <IconDelete style={{marginRight: '4px'}} />,
        onClick: () => setConfirmDelete(true),
        disabled: selectedCalls.length === 0,
      },
    ],
  ];

  return (
    <>
      {confirmDelete && (
        <ConfirmDeleteModal
          calls={selectedCalls}
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
        />
      )}
      <AddToDatasetDrawer
        entity={selectedCalls[0]?.entity ?? ''}
        project={selectedCalls[0]?.project ?? ''}
        open={addToDatasetModalOpen}
        onClose={() => setAddToDatasetModalOpen(false)}
        selectedCallIds={selectedCalls.map(call => call.callId)}
      />
      <PopupDropdown
        sections={menuOptions}
        trigger={
          <Button
            className="row-actions-button"
            icon="overflow-horizontal"
            size="medium"
            variant="ghost"
            style={{marginLeft: '4px'}}
          />
        }
        offset="-178px, -16px"
      />
    </>
  );
};

const CallName = styled.p`
  font-size: 16px;
  line-height: 18px;
  font-weight: 600;
  letter-spacing: 0px;
  text-align: left;
`;
CallName.displayName = 'S.CallName';

const CallNameRow = styled.div`
  display: flex;
  align-items: center;
  margin-top: 8px;
`;
CallNameRow.displayName = 'S.CallNameRow';

const CallIdDiv = styled.div`
  margin-left: 4px;
`;
CallIdDiv.displayName = 'S.CallIdDiv';

const DialogContent = styled(MaterialDialogContent)`
  padding: 0 32px !important;
`;
DialogContent.displayName = 'S.DialogContent';

const DialogTitle = styled(MaterialDialogTitle)`
  padding: 32px 32px 16px 32px !important;

  h2 {
    font-weight: 600;
    font-size: 24px;
    line-height: 30px;
  }
`;
DialogTitle.displayName = 'S.DialogTitle';

const DialogActions = styled(MaterialDialogActions)<{$align: string}>`
  justify-content: ${({$align}) =>
    $align === 'left' ? 'flex-start' : 'flex-end'} !important;
  padding: 32px 32px 32px 32px !important;
`;
DialogActions.displayName = 'S.DialogActions';

const MAX_DELETED_CALLS_TO_SHOW = 10;

export const ConfirmDeleteModal: FC<{
  calls: CallSchema[];
  confirmDelete: boolean;
  setConfirmDelete: (confirmDelete: boolean) => void;
  onDeleteCallback?: () => void;
}> = ({calls, confirmDelete, setConfirmDelete, onDeleteCallback}) => {
  const {loading: viewerLoading, userInfo} = useViewerUserInfo2();
  const userInfoLoaded = !viewerLoading ? userInfo : null;
  const {orgName} = useOrgName({
    entityName: userInfoLoaded?.username ?? '',
    skip: viewerLoading,
  });
  const {useCallsDeleteFunc} = useWFHooks();
  const callsDelete = useCallsDeleteFunc();
  const closePeek = useClosePeek();

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteTargetStr = makeDeleteTargetStr(calls);

  // Deletion requires constant entity/project, break calls into groups
  const makeProjectGroups = (mixedCalls: CallSchema[]) => {
    const projectGroups: {[key: string]: string[]} = {};
    mixedCalls.forEach(call => {
      const projectKey = `${call.entity}/${call.project}`;
      projectGroups[projectKey] = projectGroups[projectKey] || [];
      projectGroups[projectKey].push(call.callId);
    });
    return projectGroups;
  };

  const onDelete = () => {
    if (calls.length === 0) {
      setError(`No ${deleteTargetStr} selected`);
      return;
    }
    setDeleteLoading(true);
    userEvents.deleteClicked({
      callIds: calls.map(
        call => `${call.entity}/${call.project}/${call.callId}`
      ),
      numCalls: calls.length,
      userId: userInfoLoaded?.id ?? '',
      organizationName: orgName,
      username: userInfoLoaded?.username ?? '',
    });

    const projectGroups = makeProjectGroups(calls);
    const deletePromises: Array<Promise<void>> = [];
    Object.keys(projectGroups).forEach(projectKey => {
      const [entity, project] = projectKey.split('/');
      deletePromises.push(
        callsDelete({
          entity,
          project,
          callIDs: projectGroups[projectKey],
        })
      );
    });
    Promise.all(deletePromises)
      .then(() => {
        setDeleteLoading(false);
        setConfirmDelete(false);
        onDeleteCallback?.();
        closePeek();
      })
      .catch(() => {
        setError(`Error deleting ${deleteTargetStr}`);
        setDeleteLoading(false);
      });
  };

  return (
    <Dialog
      open={confirmDelete}
      onClose={() => {
        setConfirmDelete(false);
        setError(null);
      }}
      maxWidth="xs"
      fullWidth>
      <DialogTitle>Delete {deleteTargetStr}</DialogTitle>
      <DialogContent style={{overflow: 'hidden'}}>
        {error != null ? (
          <p style={{color: 'red'}}>{error}</p>
        ) : (
          <p>Are you sure you want to delete?</p>
        )}
        {calls.slice(0, MAX_DELETED_CALLS_TO_SHOW).map(call => (
          <CallNameRow key={call.callId}>
            <div>
              <CallName>{callDisplayName(call)}</CallName>
            </div>
            <CallIdDiv>
              <CopyableId id={call.callId} type="Call" />
            </CallIdDiv>
          </CallNameRow>
        ))}
        {calls.length > MAX_DELETED_CALLS_TO_SHOW && (
          <p style={{marginTop: '8px'}}>
            and {calls.length - MAX_DELETED_CALLS_TO_SHOW} more...
          </p>
        )}
      </DialogContent>
      <DialogActions $align="left">
        <Button
          variant="destructive"
          disabled={error != null || deleteLoading}
          onClick={onDelete}>
          {`Delete ${deleteTargetStr}`}
        </Button>
        <Button
          variant="ghost"
          disabled={deleteLoading}
          onClick={() => {
            setConfirmDelete(false);
            setError(null);
          }}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const callDisplayName = (call: CallSchema) => {
  if (call.displayName) {
    return call.displayName;
  }
  return call.spanName;
};

const makeDeleteTargetStr = (calls: CallSchema[]) => {
  if (calls.length === 0) {
    return 'calls';
  }

  let evaluationCount = 0;
  for (const call of calls) {
    if (isEvaluateOp(call.spanName)) {
      ++evaluationCount;
    }
  }

  if (evaluationCount > 0) {
    if (evaluationCount === calls.length) {
      // All evaluations
      return maybePluralizeWord(calls.length, 'evaluation');
    }
    // Mixed calls and evaluations
    return (
      maybePluralizeWord(evaluationCount, 'evaluation') +
      ' and ' +
      maybePluralizeWord(calls.length - evaluationCount, 'call')
    );
  }
  // All calls
  return maybePluralizeWord(calls.length, 'call');
};
