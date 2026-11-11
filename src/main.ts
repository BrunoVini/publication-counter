import { mount } from 'svelte'
import App from './ui/App.svelte'

export default mount(App, { target: document.getElementById('app')! })
