import {
  confirm,
  IconButton,
  EditIcon,
  FlagIcon,
  FlagFilledIcon,
  ReplyIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@hypothesis/frontend-shared';

import type { SavedAnnotation } from '../../../types/api';
import type { SidebarSettings } from '../../../types/config';
import { serviceConfig } from '../../config/service-config';
import { annotationRole } from '../../helpers/annotation-metadata';
import { sharingEnabled } from '../../helpers/annotation-sharing';
import { isPrivate, permits } from '../../helpers/permissions';
import { withServices } from '../../service-context';
import type { AnnotationsService } from '../../services/annotations';
import type { ToastMessengerService } from '../../services/toast-messenger';
import { useSidebarStore } from '../../store';
import AnnotationShareControl from './AnnotationShareControl';

// --- added for voting feature --- 
import { privatePermissions, sharedPermissions } from '../../helpers/permissions';



function flaggingEnabled(settings: SidebarSettings) {
  const service = serviceConfig(settings);
  if (service?.allowFlagging === false) {
    return false;
  }
  return true;
}

export type AnnotationActionBarProps = {
  annotation: SavedAnnotation;

  // --- added for voting feature ---
  // Allow optional params so we can pass tags through without changing callers.
  onReply: (annotation?: SavedAnnotation, text?: string, tags?: string[]) => void;
  // --- end voting feature ---

  // injected
  annotationsService: AnnotationsService;
  settings: SidebarSettings;
  toastMessenger: ToastMessengerService;
};

/**
 * A collection of buttons in the footer area of an annotation that take
 * actions on the annotation.
 *
 * @param {AnnotationActionBarProps} props
 */
function AnnotationActionBar({
  annotation,
  annotationsService,
  onReply,
  settings,
  toastMessenger,
}: AnnotationActionBarProps) {
  const store = useSidebarStore();
  const userProfile = store.profile();
  const isLoggedIn = store.isLoggedIn();


// [VOTE] --- begin additions ---

const ThumbsUpIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className || "w-5 h-5"}
  >
    <path d="M2 10h4v12H2V10zm20-1c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 0 7.59 5.59C7.22 5.95 7 6.45 7 7v11c0 1.1.9 2 2 2h8c.84 0 1.54-.52 1.84-1.25l3.02-7.05c.09-.23.14-.47.14-.7V9z" />
  </svg>
);

const ThumbsDownIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className || "w-5 h-5"}
    style={{ transform: 'rotate(180deg)' }}
    style={{ transform: 'scale(-1, -1)' }}
  >
    <path d="M2 10h4v12H2V10zm20-1c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 0 7.59 5.59C7.22 5.95 7 6.45 7 7v11c0 1.1.9 2 2 2h8c.84 0 1.54-.52 1.84-1.25l3.02-7.05c.09-.23.14-.47.14-.7V9z" />
  </svg>
);




// --- added for voting feature ---
// Only allow voting on top-level annotations (not replies)
const isReply =
  Array.isArray(annotation.references) && annotation.references.length > 0;

// If this annotation itself is a vote-reply, don’t show vote buttons
const isVoteAnnotation = annotation.tags?.some(t => t.startsWith('vote:'));

const shouldShowVoting = !isReply && !isVoteAnnotation;
// Utility to get all replies that are vote annotations for this parent

const getVoteReplies = () => {
  const storeAny = store as unknown as Record<string, any>;
  const allAnns: SavedAnnotation[] =
    (typeof storeAny.allAnnotations === 'function' && storeAny.allAnnotations()) ||
    (typeof storeAny.annotations === 'function' && storeAny.annotations()) ||
    [];

  return allAnns.filter(a => {
    const refs = a.references || [];
    return (
      refs.length > 0 &&
      refs[refs.length - 1] === annotation.id &&
      a.tags?.some(t => t.startsWith('vote:'))
    );
  });
};

// Compute like/dislike counts
const voteReplies = getVoteReplies();
const likeCount = voteReplies.filter(r => r.tags?.includes('vote:like')).length;
const dislikeCount = voteReplies.filter(r => r.tags?.includes('vote:dislike')).length;

// Find current user’s vote
const userid = userProfile.userid!;
const myExistingVote = voteReplies.find(r => r.user === userid);
const myVoteType = myExistingVote
  ? (myExistingVote.tags?.includes('vote:like') ? 'like' : 'dislike')
  : null;

const onVote = async (type: 'like' | 'dislike') => {
  if (!isLoggedIn) {
    store.openSidebarPanel('loginPrompt');
    return;
  }

  try {
    // Toggle off if same vote
    if (myVoteType === type && myExistingVote) {
      await annotationsService.delete(myExistingVote);
      return;
    }

    // Remove opposite vote first
    if (myExistingVote) {
      await annotationsService.delete(myExistingVote);
    }

    const voteTags = [
      `vote:${type}`,
      `user:${userid}`,
      `timestamp:${new Date().toISOString()}`,
    ];

    const replyAnn = annotationsService.annotationFromData({
      references: (annotation.references || []).concat(annotation.id),
      group: annotation.group,
      uri: annotation.uri,
      target: [{ source: annotation.target?.[0]?.source }],
      text: '',
      tags: voteTags,
      permissions: !isPrivate(annotation.permissions)
        ? sharedPermissions(userid, annotation.group)
        : privatePermissions(userid),
    });

    await annotationsService.save(replyAnn);
  } catch (err: any) {
    toastMessenger.error(err?.message ?? 'Failed to record vote');
  }
};
// --- end voting feature ---


  // Is the current user allowed to take the given `action` on this annotation?
  const userIsAuthorizedTo = (action: 'update' | 'delete') => {
    return permits(annotation.permissions, action, userProfile.userid);
  };

  const showDeleteAction = userIsAuthorizedTo('delete');
  const showEditAction = userIsAuthorizedTo('update');

  //  Only authenticated users can flag an annotation, except the annotation's author.
  const showFlagAction =
    flaggingEnabled(settings) &&
    !!userProfile.userid &&
    userProfile.userid !== annotation.user;

  const onDelete = async () => {
    const annType = annotationRole(annotation);
    if (
      await confirm({
        title: `Delete ${annType.toLowerCase()}?`,
        message: `Are you sure you want to delete this ${annType.toLowerCase()}?`,
        confirmAction: 'Delete',
      })
    ) {
      try {
        await annotationsService.delete(annotation);
        toastMessenger.success(`${annType} deleted`, { visuallyHidden: true });
      } catch (err: any) {
        toastMessenger.error(err.message);
      }
    }
  };

  const onEdit = () => {
    store.createDraft(annotation, {
      tags: annotation.tags,
      text: annotation.text,
      isPrivate: isPrivate(annotation.permissions),
      description: annotation.target[0]?.description,
    });
  };

  const onFlag = () => {
    annotationsService
      .flag(annotation)
      .catch(() => toastMessenger.error('Flagging annotation failed'));
  };

  const onReplyClick = () => {
    if (!isLoggedIn) {
      store.openSidebarPanel('loginPrompt');
      return;
    }
    onReply();
  };

  const showShareAction = sharingEnabled(settings);

  return (
    <div className="flex text-[16px]" data-testid="annotation-action-bar">

     {/* --- added for voting feature ---
          Place Like/Dislike buttons just BEFORE the Reply button */}
      {shouldShowVoting && (
        <>
          <div className="flex items-center gap-1">
            <IconButton
              icon={ThumbsUpIcon}
              title={`Like (${likeCount})`}
              pressed={myVoteType === 'like'}
              onClick={() => onVote('like')}
            />
            <span className="min-w-[1ch] text-sm tabular-nums">{likeCount}</span>
          </div>

          <div className="flex items-center gap-1">
            <IconButton
              icon={ThumbsDownIcon}
              title={`Dislike (${dislikeCount})`}
              pressed={myVoteType === 'dislike'}
              onClick={() => onVote('dislike')}
            />
            <span className="min-w-[1ch] text-sm tabular-nums">{dislikeCount}</span>
          </div>
        </>
      )}

      {showEditAction && (
        <IconButton icon={EditIcon} title="Edit" onClick={onEdit} />
      )}
      {showDeleteAction && (
        <IconButton icon={TrashIcon} title="Delete" onClick={onDelete} />
      )}

      <IconButton icon={ReplyIcon} title="Reply" onClick={onReplyClick} />
      {showShareAction && <AnnotationShareControl annotation={annotation} />}
      {showFlagAction && !annotation.flagged && (
        <IconButton
          icon={FlagIcon}
          title="Report this annotation to moderators"
          onClick={onFlag}
        />
      )}
      {showFlagAction && annotation.flagged && (
        <IconButton
          pressed={true}
          icon={FlagFilledIcon}
          title="Annotation has been reported to the moderators"
        />
      )}
    </div>
  );
}

export default withServices(AnnotationActionBar, [
  'annotationsService',
  'settings',
  'toastMessenger',
]);
