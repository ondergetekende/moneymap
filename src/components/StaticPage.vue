<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="static-page-wrapper">
    <div class="static-page-card">
      <header class="static-page-header">
        <h1>{{ title }}</h1>
        <p v-if="subtitle" class="static-page-subtitle">{{ subtitle }}</p>
      </header>

      <div class="static-page-body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.static-page-wrapper {
  display: flex;
  justify-content: center;
  padding: $spacing-3xl 0;

  @include mobile {
    padding: $spacing-xl 0;
  }

  @include mobile-small {
    padding: $spacing-lg 0;
  }
}

.static-page-card {
  width: 100%;
  max-width: $form-max-width;
  background: $bg-card;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  padding: $spacing-4xl;

  @include mobile {
    padding: $spacing-3xl;
    border-radius: 0;
    box-shadow: none;
  }

  @include mobile-small {
    padding: $spacing-2xl $spacing-lg;
    border-radius: 0;
    box-shadow: none;
  }
}

.static-page-header {
  margin-bottom: $spacing-3xl;
  text-align: center;

  @include mobile {
    margin-bottom: $spacing-2xl;
  }

  @include mobile-small {
    margin-bottom: $spacing-xl;
  }

  h1 {
    font-size: $font-2xl;
    font-weight: $font-bold;
    color: $text-primary;
    margin: 0;
  }

  @include mobile {
    h1 {
      font-size: $font-xl-2;
    }
  }

  @include mobile-small {
    h1 {
      font-size: $font-xl;
    }
  }
}

.static-page-subtitle {
  font-size: $font-base-lg;
  color: $text-muted;
  margin-top: $spacing-sm;
  margin-bottom: 0;
}

.static-page-body {
  font-size: $font-base-lg;
  color: $text-secondary;
  line-height: $line-height-base;

  h2 {
    font-size: $font-lg;
    font-weight: $font-semibold;
    color: $text-primary;
    margin-top: $spacing-2xl;
    margin-bottom: $spacing-sm;
  }

  h3 {
    font-size: $font-base-lg;
    font-weight: $font-semibold;
    color: $text-primary;
    margin-top: $spacing-lg;
    margin-bottom: $spacing-sm;
  }

  p {
    margin-bottom: $spacing-base;
  }

  ul,
  ol {
    margin-bottom: $spacing-xl;
    padding-left: $spacing-lg;

    li {
      margin-bottom: $spacing-sm;
      padding: $spacing-sm $spacing-md;
      background: $bg-alt-3;
      border-radius: $radius-md;
    }
  }

  @include mobile {
    ul,
    ol {
      padding-left: $spacing-base;
    }

    ul li,
    ol li {
      margin-left: 0;
      margin-right: 0;
    }
  }

  a {
    color: $primary;
    text-decoration: none;
    font-weight: $font-medium;
    background: $primary-light;
    padding: $spacing-xs $spacing-sm;
    border-radius: $radius-base;
    transition: $transition-base;

    &:hover {
      background-color: $primary;
      color: white;
      text-decoration: none;
    }
  }

  @include mobile-small {
    font-size: $font-base;
  }
}
</style>
