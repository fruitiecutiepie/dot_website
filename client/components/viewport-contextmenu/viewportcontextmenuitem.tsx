import React from 'react'
import type {
  IViewportContextMenuItemProps,
  IViewportContextMenuItemState,
} from './viewport-contextmenu-models'
import {
  ViewportContextMenuItemsType,
} from './viewport-contextmenu-models'

class ViewportContextMenuItem extends React.Component<
  IViewportContextMenuItemProps,
  IViewportContextMenuItemState
> {
  constructor(props: IViewportContextMenuItemProps) {
    super(props)
    this.state = {
      itemType: this.props.itemType,
      isDisabled: this.props.isDisabled || false,
    }

    this.handleClick = this.handleClick.bind(this)
  }

  // componentDidUpdate(prevProps: Readonly<IViewportContextMenuItemProps>, prevState: Readonly<IViewportContextMenuItemState>, snapshot?: any): void {
  //   console.log('viewportContextMenuItem.componentDidUpdate')
  //   if (this.props.isDisabled !== prevProps.isDisabled) {
  //     this.setState({
  //       isDisabled: this.props.isDisabled,
  //     })
  //   }
  // }
  
  // static getDerivedStateFromProps(nextProps: IViewportContextMenuItemProps, prevState: IViewportContextMenuItemState) {
  //   if (nextProps.isDisabled !== prevState.isDisabled) {
  //     return {
  //       isDisabled: nextProps.isDisabled,
  //     };
  //   }
  //   return null;
  // }

  UNSAFE_componentWillReceiveProps(nextProps: IViewportContextMenuItemProps) {
    if (nextProps.isDisabled !== this.state.isDisabled) {
      this.setState({
        isDisabled: nextProps.isDisabled,
      })
    }
  }

  private handleClick(event: React.MouseEvent<HTMLLIElement>) {
    this.props.handleClick(event)
    this.props.setVisibility(false)
  }

  public render() {
    const className = ['viewportContextMenuItem']
    if (this.state.isDisabled)
      className.push('disabled')

    if (this.state.itemType === ViewportContextMenuItemsType.Separator) {
      className.push('disabled')
      className.push('separator')
    }

    if (this.state.itemType === ViewportContextMenuItemsType.Separator) {
      return <li className={className.join(' ')} />
    }
    else {
      return (
        <li className={className.join(' ')} onClick={this.handleClick}>
          {this.state.itemType}
        </li>
      )
    }
  }
}

export default ViewportContextMenuItem
