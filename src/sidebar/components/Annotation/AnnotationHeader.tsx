import {
  AnnotationDocumentInfo,
  AnnotationGroupInfo,
  AnnotationTimestamps,
  AnnotationUser,
} from '@hypothesis/annotation-ui';
import {
  LinkButton,
  HighlightIcon,
  LockFilledIcon,
} from '@hypothesis/frontend-shared';
import { useMemo } from 'preact/hooks';

import type { Annotation } from '../../../types/api';
import type { SidebarSettings } from '../../../types/config';
import {
  domainAndTitle,
  isHighlight,
  isReply,
  hasBeenEdited,
  pageLabel as getPageLabel,
} from '../../helpers/annotation-metadata';
import {
  annotationAuthorLink,
  annotationDisplayName,
} from '../../helpers/annotation-user';
import { isPrivate } from '../../helpers/permissions';
import { withServices } from '../../service-context';
import { useSidebarStore } from '../../store';

export type AnnotationHeaderProps = {
  annotation: Annotation;
  isEditing?: boolean;
  replyCount: number;
  threadIsCollapsed: boolean;

  // injected
  settings: SidebarSettings;
};

/**
 * Render an annotation's header summary, including metadata about its user,
 * sharing status, document and timestamp. It also allows the user to
 * toggle sub-threads/replies in certain cases.
 *
 * @param {AnnotationHeaderProps} props
 */
function AnnotationHeader({
  annotation,
  isEditing,
  replyCount,
  threadIsCollapsed,
  settings,
}: AnnotationHeaderProps) {
  const store = useSidebarStore();

  const defaultAuthority = store.defaultAuthority();
  const displayNamesEnabled = store.isFeatureEnabled('client_display_names');
  const userURL = store.getLink('user', { user: annotation.user });

  const authorName = useMemo(
    () =>
      annotationDisplayName(annotation, defaultAuthority, displayNamesEnabled),
    [annotation, defaultAuthority, displayNamesEnabled],
  );

  const authorLink = useMemo(
    () => annotationAuthorLink(annotation, settings, defaultAuthority, userURL),
    [annotation, settings, defaultAuthority, userURL],
  );

  const isCollapsedReply = isReply(annotation) && threadIsCollapsed;

  // Link (URL) to single-annotation view for this annotation, if it has
  // been provided by the service. Note: this property is not currently
  // present on third-party annotations.
  const annotationURL = annotation.links?.html || '';

  const showEditedTimestamp = useMemo(() => {
    return hasBeenEdited(annotation) && !isCollapsedReply;
  }, [annotation, isCollapsedReply]);

  // Pull together some document metadata related to this annotation
  const documentInfo = domainAndTitle(annotation);
  // There are some cases at present in which linking directly to an
  // annotation's document is not immediately feasible—e.g in an LMS context
  // where the original document might not be available outside of an
  // assignment (e.g. Canvas files), and/or wouldn't be able to present
  // any associated annotations.
  // For the present, disable links to annotation documents for all third-party
  // annotations until we have a more nuanced way of making linking determinations.
  // The absence of a link to a single-annotation view is a signal that this
  // is a third-party annotation.
  // Also, of course, verify that there is a URL to the document (titleLink)
  const documentLink =
    annotationURL && documentInfo.titleLink ? documentInfo.titleLink : '';
  // Show document information on non-sidebar routes, assuming there is a title
  // to show, at the least
  const showDocumentInfo =
    store.route() !== 'sidebar' && documentInfo.titleText;

  const onReplyCountClick = () =>
    // If an annotation has replies it must have been saved and therefore have
    // an ID.
    store.setExpanded(annotation.id!, true);

  // As part of the `page_numbers` feature, we are hiding the group on cards in
  // contexts where it is the same for all cards and is shown elsewhere in the
  // UI (eg. the top bar). This is to reduce visual clutter.
  let group;
  if (store.route() !== 'sidebar') {
    group = store.getGroup(annotation.group);
  }
  const pageNumber = getPageLabel(annotation);

  return (
    <header>
      <div className="flex gap-x-1 items-center flex-wrap-reverse">
        {isPrivate(annotation.permissions) && !isEditing && (
          <LockFilledIcon
            className="w-[12px] h-[12px]"
            title="This annotation is visible only to you"
          />
        )}
        <AnnotationUser authorLink={authorLink} displayName={authorName} />
        {replyCount > 0 && isCollapsedReply && (
          <LinkButton
            variant="text-light"
            onClick={onReplyCountClick}
            title="Expand replies"
            underline="hover"
          >
            {`${replyCount} ${replyCount > 1 ? 'replies' : 'reply'}`}
          </LinkButton>
        )}

        {!isEditing && annotation.created && (
          <div className="flex justify-end grow">
            <AnnotationTimestamps
              annotationCreated={annotation.created}
              annotationUpdated={annotation.updated}
              annotationURL={annotationURL}
              withEditedTimestamp={showEditedTimestamp}
            />
          </div>
        )}
      </div>

      {!isReply(annotation) && (
        <div
          className="flex gap-x-1 items-baseline flex-wrap-reverse"
          data-testid="extended-header-info"
        >
          {group && <AnnotationGroupInfo group={group} />}
          {!isEditing && isHighlight(annotation) && (
            <HighlightIcon
              title="This is a highlight. Click 'edit' to add a note or tag."
              className="w-[10px] h-[10px] text-color-text-light"
            />
          )}
          {(showDocumentInfo || pageNumber) && (
            <span className="flex">
              {showDocumentInfo && (
                <AnnotationDocumentInfo
                  domain={documentInfo.domain}
                  link={documentLink}
                  title={documentInfo.titleText}
                />
              )}
              {pageNumber && (
                <span className="text-grey-6" data-testid="page-number">
                  {showDocumentInfo && ', '}p. {pageNumber}
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </header>
  );
}

export default withServices(AnnotationHeader, ['settings']);
