import { Component } from "react";

type Props = { when: unknown; take: () => void };

/**
 * Calls `take` just before React changes the DOM, whenever `when` changes:
 * the moment the old layout can still be measured (what Motion's layout
 * animations measured from). Renders nothing. A class, because
 * getSnapshotBeforeUpdate has no hook; React runs it for the whole tree
 * before any DOM change, so its siblings are still in their old places.
 */
export class Snapshot extends Component<Props> {
  getSnapshotBeforeUpdate(previous: Readonly<Props>) {
    if (!Object.is(previous.when, this.props.when)) this.props.take();
    return null;
  }

  componentDidUpdate() {}

  render() {
    return null;
  }
}
