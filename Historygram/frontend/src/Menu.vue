<script setup lang="ts">
import '@material/web/all.js';
import { styles as typescaleStyles } from '@material/web/typography/md-typescale-styles.js';

if (typescaleStyles.styleSheet) {
  document.adoptedStyleSheets.push(typescaleStyles.styleSheet);
}
</script>


<template>
  <md-tabs class="bottom-tabs">
    <md-primary-tab active>
      <md-icon slot="icon">web_stories</md-icon>
      Истории
    </md-primary-tab>
    <md-primary-tab>
      <md-icon slot="icon">add</md-icon>
      Создать
    </md-primary-tab>
    <md-primary-tab>
      <md-icon slot="icon">account_circle</md-icon>
      Аккаунт
    </md-primary-tab>
  </md-tabs>
</template>

<style scoped>
.bottom-tabs {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 100;

  padding-bottom: env(safe-area-inset-bottom);
  background-color: var(--md-sys-color-surface, #ffffff);
}
</style>
