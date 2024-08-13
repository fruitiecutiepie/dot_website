import React from 'react'
import './searchbar.css'

export function ArrowUp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg id="icon" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 32 32">
      <defs>
        <style>{
          `.cls-1 {
            fill: none;
          }`
        }</style>
      </defs>
      <polygon fill="white" points="16 4 6 14 7.41 15.41 15 7.83 15 28 17 28 17 7.83 24.59 15.41 26 14 16 4"/>
      <rect id="_Transparent_Rectangle_" data-name="&lt;Transparent Rectangle&gt;" className="cls-1" width="1em" height="1em"/>
    </svg>
  )
}

export function ArrowDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg id="icon" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 32 32">
      <defs>
        <style>{
          `.cls-1 {
            fill: none;
          }`
        }</style>
      </defs>
      <polygon fill="white" points="24.59 16.59 17 24.17 17 4 15 4 15 24.17 7.41 16.59 6 18 16 28 26 18 24.59 16.59"/>
      <rect id="_Transparent_Rectangle_" data-name="&lt;Transparent Rectangle&gt;" className="cls-1" width="1em" height="1em"/>
    </svg>
  )
}

export function Close(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg id="icon" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 32 32">
      <defs>
        <style>{
          `.cls-1 {
            fill: none;
          }`
        }</style>
      </defs>
      <polygon fill="white" points="17.4141 16 24 9.4141 22.5859 8 16 14.5859 9.4143 8 8 9.4141 14.5859 16 8 22.5859 9.4143 24 16 17.4141 22.5859 24 24 22.5859 17.4141 16" />
      <g id="_Transparent_Rectangle_" data-name="&amp;lt;Transparent Rectangle&amp;gt;">
        <rect className="cls-1" width="1em" height="1em" />
      </g>
    </svg>
  )
}

interface ISearchBarState {
  text: string
  matchesLength: number | undefined
  
  isFocused: boolean
  previousMatchIndex: number
  currentMatchIndex: number
}

interface ISearchBarProps {
  onActionInvoked: (action: string, data?: object) => Promise<any>
}

class SearchBar extends React.Component<ISearchBarProps, ISearchBarState> {
  private ref?: HTMLInputElement
  constructor(props: any) {
    super(props)
    this.state = {
      text: '',
      matchesLength: undefined,
      
      isFocused: false,
      previousMatchIndex: 0,
      currentMatchIndex: 0,
    }

    this.setRef = this.setRef.bind(this)
    this.handleChange = this.handleChange.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleFocus = this.handleFocus.bind(this)
    this.handleBlur = this.handleBlur.bind(this)
    this.handlePrevious = this.handlePrevious.bind(this)
    this.handleNext = this.handleNext.bind(this)
    this.handleClose = this.handleClose.bind(this)
  }

  public render() {
    return (
      <div className="inner search-bar">
        <input
          type="text"
          ref={this.setRef}
          value={this.state.text}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          onChange={this.handleChange}
          onKeyDown={this.handleKeyDown}
        />
        <span>
          {this.state.matchesLength && this.state.matchesLength > 0
            ? `${this.state.currentMatchIndex + 1} / ${this.state.matchesLength}`
            : 'No matches'
          }
        </span>
        <button
          onClick={this.handlePrevious}
        >
          <ArrowUp />
        </button>
        <button
          onClick={this.handleNext}
        >
          <ArrowDown />
        </button>
        <button
          onClick={this.handleClose}  
        >
          <Close />
        </button>
      </div>
    )
  }

  private setRef(node: HTMLInputElement) {
    this.ref = node
  }
  
  private async handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({
      text: e.target.value,
      matchesLength: undefined,
    })
    const matchesLength = await this.props.onActionInvoked('findSearchBarQuery', {
      text: e.target.value,
      currentMatchIndex: this.state.currentMatchIndex
    });
    console.log(`handleChange: matchesLength=${matchesLength}`)
    if (matchesLength) {
      this.setState({
        matchesLength,
        // currentMatchIndex: 0, 
        // TODO: reset when ctrl+ f is pressed
      })
    }
  }

  private handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      this.handleNext()
    }
  }

  private handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    this.selectText(e.target)
    this.setState({
      isFocused: true,
    })
  }

  // select all url from child components
  private selectText(element?: HTMLInputElement) {
    if (!element && this.ref)
      element = this.ref

    if (element) {
      element.select()
      this.setState({
        isFocused: true,
      })
    }
  }

  private handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    this.setState({
      isFocused: false,
    })
  }

  private handlePrevious() {
    this.setState(prevState => {
      if (!prevState.matchesLength || prevState.matchesLength === 0) {
        return prevState;
      }
      return {
        ...prevState,
        previousMatchIndex: prevState.currentMatchIndex,
        currentMatchIndex: (prevState.currentMatchIndex - 1 + prevState.matchesLength) % prevState.matchesLength,
      };
    });
    this.props.onActionInvoked('scrollToFindSearchBarQueryMatch', {
      previousIndex: this.state.previousMatchIndex,
      currentIndex: this.state.currentMatchIndex
    })
  }

  private handleNext() {
    this.setState(prevState => {
      if (!prevState.matchesLength || prevState.matchesLength === 0) {
        return prevState;
      }
      return {
        ...prevState,
        previousMatchIndex: prevState.currentMatchIndex,
        currentMatchIndex: (prevState.currentMatchIndex + 1) % prevState.matchesLength,
      };
    });
    this.props.onActionInvoked('scrollToFindSearchBarQueryMatch', {
      previousIndex: this.state.previousMatchIndex,
      currentIndex: this.state.currentMatchIndex
    })
  }

  private handleClose() {
    this.setState({
      text: '',
      matchesLength: undefined,
      isFocused: false,
    })
    this.props.onActionInvoked('closeFindSearchBar')
  }
}

export default SearchBar
