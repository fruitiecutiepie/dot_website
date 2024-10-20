import React from 'react'
import './viewport.css'

import { Resizable } from 're-resizable'
import debounce from 'lodash/debounce'
import Loading from '../loading-bar/loading-bar'
import Screencast from '../screencast/screencast'
import { ErrorPage } from '../error-page/error-page'
import ViewportContextMenu from '../viewport-contextmenu/viewport-contextmenu'
import { IViewportContextMenuProps } from '../viewport-contextmenu/viewport-contextmenu-models'

interface IViewportState {
  isFocused: boolean
  viewportContextMenuProps: IViewportContextMenuProps
}

class Viewport extends React.Component<any, IViewportState> {
  public contextMenuRef: React.RefObject<ViewportContextMenu>
  private viewportRef: React.RefObject<HTMLDivElement>
  private debouncedResizeHandler: any
  private viewportPadding: any
  private onActionInvoked: any

  constructor(props: any) {
    super(props)
    
    this.state = {
      isFocused: false,
      viewportContextMenuProps: {
        menuItems: [],
        isVisible: false,
        selectedElementUid: '',
        position: { x: 0, y: 0 },
        setVisibility: this.setVisibility.bind(this),
        onActionInvoked: this.props.onActionInvoked,
        selectedElementText:'',
        isSelectedElementEditable: false,
        href: '',
      },
    }  
    this.contextMenuRef = React.createRef<ViewportContextMenu>()
    this.viewportRef = React.createRef<HTMLDivElement>()
    this.viewportPadding = {
      top: 70,
      left: 30,
      right: 30,
      bottom: 30,
    }

    this.debouncedResizeHandler = debounce(this.handleViewportResize.bind(this), 50)
    this.handleFocus = this.handleFocus.bind(this)
    this.handleBlur = this.handleBlur.bind(this)
    this.handleInspectElement = this.handleInspectElement.bind(this)
    this.handleInspectHighlightRequested = this.handleInspectHighlightRequested.bind(this)
    this.handleScreencastInteraction = this.handleScreencastInteraction.bind(this)
    this.handleScreencastError = this.handleScreencastError.bind(this)
    this.handleResizeStop = this.handleResizeStop.bind(this)
    this.handleMouseMoved = this.handleMouseMoved.bind(this)
    this.onActionInvoked = this.props.onActionInvoked.bind(this)
    this.handleContextMenu = this.handleContextMenu.bind(this)
  }

  public componentDidMount() {
    this.debouncedResizeHandler()
    window.addEventListener('resize', this.debouncedResizeHandler)
  }

  public componentWillUnmount() {
    window.removeEventListener('resize', this.debouncedResizeHandler)
  }

  public render() {
    const viewport = this.props.viewport

    const width = Math.round(viewport.width * viewport.screenZoom)
    const height = Math.round(viewport.height * viewport.screenZoom)

    let resizableEnableOptions = {
      top: false,
      right: false,
      bottom: false,
      left: false,
      topRight: false,
      bottomRight: false,
      bottomLeft: false,
      topLeft: false,
    }

    if (viewport.isResizable) {
      resizableEnableOptions = {
        top: true,
        topRight: true,
        topLeft: true,
        bottom: true,
        bottomRight: true,
        bottomLeft: true,
        left: true,
        right: true,
      }
    }
    
    return (
      <div
        className={`viewport ${this.props.isDeviceEmulationEnabled ? 'viewport-resizable' : ''}`}
        ref={this.viewportRef}
        onContextMenu={this.handleContextMenu}
      >
      <Loading percent={viewport.loadingPercent} />
      {
        this.props.errorText
        ? (
          <ErrorPage
            errorText={this.props.errorText}
            onActionInvoked={this.onActionInvoked}
          />
        )
        : (
          <>
            <Resizable
              className="viewport-resizable-wrap"
              size={{
                width,
                height,
              }}
              onResizeStop={this.handleResizeStop}
              enable={resizableEnableOptions}
              handleClasses={{
                bottom: 'viewport-resizer resizer-bottom',
                bottomRight: 'viewport-resizer resizer-bottom-right',
                bottomLeft: 'viewport-resizer resizer-bottom-left',
                left: 'viewport-resizer resizer-left',
                right: 'viewport-resizer resizer-right',
                top: 'viewport-resizer resizer-top',
                topRight: 'viewport-resizer resizer-top-right',
                topLeft: 'viewport-resizer resizer-top-left',
            }}
            >    
              <Screencast
                height={height}
                width={width}
                frame={this.props.frame}
                format={this.props.format}
                viewportMetadata={viewport}
                isInspectEnabled={this.props.isInspectEnabled}
                onInspectElement={this.handleInspectElement}
                onInspectHighlightRequested={this.handleInspectHighlightRequested}
                onInteraction={this.handleScreencastInteraction}
                onMouseMoved={this.handleMouseMoved}
                onError={this.handleScreencastError}
              />
            </Resizable>
          </>
        )
      }
      <ViewportContextMenu ref={this.contextMenuRef} {...this.state.viewportContextMenuProps}  />
      </div>
    )
  }

    private handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault(); 
        const viewportOffsetTop = this.viewportRef.current?.getBoundingClientRect().top ?? 0;
        this.setState({
            viewportContextMenuProps: {
                ...this.state.viewportContextMenuProps,
                isVisible: true,
                position: { 
                  x: e.clientX, 
                  y: e.clientY - viewportOffsetTop,
                }, 
            },
        });
    };

  public setVisibility(value: boolean) {
    this.setState({
      viewportContextMenuProps: {
        ...this.state.viewportContextMenuProps,
        isVisible: value,
      },
    })
  }

  private handleFocus(e: React.FocusEvent<React.RefObject<HTMLDivElement>>) {
    this.viewportRef?.current?.focus()
    this.setState({
      isFocused: true,
    })
  }

  private handleBlur(e: React.FocusEvent<React.RefObject<HTMLDivElement>>) {
    this.setState({
      isFocused: false,
    })
  }
  
  public calculateViewport() {
    // console.log('viewport.calculateViewport')
    this.calculateViewportSize()
    this.calculateViewportZoom()
  }
  
  private calculateViewportZoom() {
    let screenZoom = 1
    
    const viewport = this.props.viewport

    if (viewport.isFixedZoom)
      return

    if (viewport.isFixedSize) {
      const screenViewportDimensions = {
        height: window.innerHeight,
        width: window.innerWidth,
      }

      if (this.props.isDeviceEmulationEnabled) {
        // Add padding to enable space for resizers
        screenViewportDimensions.width
          = screenViewportDimensions.width - this.viewportPadding.left - this.viewportPadding.right
        screenViewportDimensions.height
          = screenViewportDimensions.height - this.viewportPadding.bottom - this.viewportPadding.top
      }

      screenZoom = Math.min(
        screenViewportDimensions.width / viewport.width,
        screenViewportDimensions.height / viewport.height,
      )
    }

    if (screenZoom === viewport.screenZoom)
      return

    // console.log('viewport.calculateViewportZoom.emitChange')

    this.emitViewportChanges({ screenZoom })
  }

  private calculateViewportSize() {
    const viewport = this.props.viewport

    if (viewport.isFixedSize)
      return

    if (this.viewportRef.current) {
      const dim = this.viewportRef.current.getBoundingClientRect()

      let viewportWidth = dim.width
      let viewportHeight = dim.height

      if (this.props.isDeviceEmulationEnabled) {
        // Add padding to enable space for resizers
        viewportWidth = viewportWidth - this.viewportPadding.left - this.viewportPadding.right
        viewportHeight = viewportHeight - this.viewportPadding.bottom - this.viewportPadding.top
      }

      viewportHeight = Math.floor(viewportHeight)
      viewportWidth = Math.floor(viewportWidth)

      if (
        viewportWidth === Math.floor(viewport.width)
        && viewportHeight === Math.floor(viewport.height)
      )
        return

      // console.log('viewport.calculateViewportSize.emitChange')

      this.emitViewportChanges({
        width: viewportWidth,
        height: viewportHeight,
      })
    }
  }

  private handleViewportResize() {
    // console.log('viewport.handleViewportResize')
    this.calculateViewport()
  }

  private handleResizeStop(e: any, direction: any, ref: any, delta: any) {
    const viewport = this.props.viewport

    this.emitViewportChanges({
      width: viewport.width + delta.width,
      height: viewport.height + delta.height,
      isFixedSize: true,
    })
  }

  private handleInspectElement(params: object) {
    this.props.onViewportChanged('inspectElement', {
      params,
    })
  }

  private handleInspectHighlightRequested(params: object) {
    this.props.onViewportChanged('inspectHighlightRequested', {
      params,
    })
  }

  private handleScreencastInteraction(action: string, params: object) {
    this.props.onViewportChanged('interaction', {
      action,
      params,
    })
  }

  private handleMouseMoved(params: object) {
    this.props.onViewportChanged('hoverElementChanged', {
      params,
    })
  }

  private emitViewportChanges(newViewport: any) {
    this.props.onViewportChanged('size', newViewport)
  }

  private handleScreencastError(errorMessage: string) {
    this.props.onViewportChanged('error', {
      errorMessage,
    })
  }
}

export default Viewport
