import { EmptyState, Button, IconTrash, IconMedia } from 'quireink'

export function Basic() {
  return <EmptyState title="No posts yet" description="Anything you write will show up here." />
}

export function WithAction() {
  return (
    <EmptyState
      title="Nothing in the media library"
      description="Drag an image in, or pick one from your computer."
      icon={<IconMedia />}
      action={<Button variant="primary">Upload an image</Button>}
    />
  )
}

export function TitleOnly() {
  return <EmptyState title="No comments to moderate." />
}

export function TrashEmpty() {
  return (
    <EmptyState
      title="The trash is empty"
      description="Deleted posts, pages and files rest here for 30 days before they go for good."
      icon={<IconTrash />}
    />
  )
}
