<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  createStory,
  deleteStory,
  fetchCurrentUser,
  fetchStories,
  loginUser,
  logoutUser,
  registerUser,
  resolveMediaUrl,
  toggleStoryLike,
  uploadAvatar,
  type Story,
  type User,
} from './api';

const DEFAULT_AVATAR = '/default-avatar.svg';

const stories = ref<Story[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const feedNotice = ref<string | null>(null);

const currentUser = ref<User | null>(null);
const isAuthChecking = ref(true);
const isAuthSubmitting = ref(false);
const authError = ref<string | null>(null);
const avatarError = ref<string | null>(null);
const isAvatarUploading = ref(false);
const isSettingsOpen = ref(false);
const deletingStoryId = ref<number | null>(null);
const profileError = ref<string | null>(null);
const selectedProfileStory = ref<Story | null>(null);

const loginForm = reactive({
  login: '',
  password: '',
});

const registerForm = reactive({
  account: '',
  email: '',
  password: '',
});

const createForm = reactive({
  title: '',
  text: '',
  imgUrl: '',
});
const storyImageFile = ref<File | null>(null);
const storyImagePreview = ref<string | null>(null);
const isCreatingStory = ref(false);
const createError = ref<string | null>(null);
const createSuccess = ref<string | null>(null);

const userStories = computed(() => {
  if (!currentUser.value) return [];
  const acc = currentUser.value.account.toLowerCase();
  return stories.value.filter((s) => s.account.toLowerCase() === acc);
});

const loadStories = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    stories.value = await fetchStories();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    isLoading.value = false;
  }
};

const checkSession = async () => {
  isAuthChecking.value = true;
  try {
    const res = await fetchCurrentUser();
    currentUser.value = res.user;
  } catch {
    currentUser.value = null;
  } finally {
    isAuthChecking.value = false;
  }
};

const handleLogin = async () => {
  authError.value = null;
  isAuthSubmitting.value = true;
  try {
    const res = await loginUser({
      login: loginForm.login,
      password: loginForm.password,
    });
    currentUser.value = res.user;
    loginForm.password = '';
    await loadStories();
  } catch (e) {
    authError.value = e instanceof Error ? e.message : 'Ошибка входа';
  } finally {
    isAuthSubmitting.value = false;
  }
};

const handleRegister = async () => {
  authError.value = null;
  isAuthSubmitting.value = true;
  try {
    const res = await registerUser({
      account: registerForm.account,
      email: registerForm.email,
      password: registerForm.password,
    });
    currentUser.value = res.user;
    registerForm.password = '';
    await loadStories();
  } catch (e) {
    authError.value = e instanceof Error ? e.message : 'Ошибка регистрации';
  } finally {
    isAuthSubmitting.value = false;
  }
};

const handleLogout = async () => {
  authError.value = null;
  avatarError.value = null;
  profileError.value = null;
  isSettingsOpen.value = false;
  selectedProfileStory.value = null;
  isAuthSubmitting.value = true;
  try {
    await logoutUser();
    currentUser.value = null;
    await loadStories();
  } catch (e) {
    authError.value = e instanceof Error ? e.message : 'Ошибка выхода';
  } finally {
    isAuthSubmitting.value = false;
  }
};

const isStoryOwner = (story: Story) => {
  if (!currentUser.value) return false;
  return story.account.toLowerCase() === currentUser.value.account.toLowerCase();
};

const handleDeleteStory = async (storyId: number) => {
  profileError.value = null;
  deletingStoryId.value = storyId;
  try {
    await deleteStory(storyId);
    if (selectedProfileStory.value?.id === storyId) {
      selectedProfileStory.value = null;
    }
    await Promise.all([loadStories(), checkSession()]);
  } catch (e) {
    profileError.value = e instanceof Error ? e.message : 'Не удалось удалить историю';
  } finally {
    deletingStoryId.value = null;
  }
};

const handleAvatarChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  avatarError.value = null;
  isAvatarUploading.value = true;
  try {
    const res = await uploadAvatar(file);
    currentUser.value = res.user;
    await loadStories();
  } catch (e) {
    avatarError.value = e instanceof Error ? e.message : 'Не удалось обновить аватар';
  } finally {
    isAvatarUploading.value = false;
    input.value = '';
  }
};

const handleStoryFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (storyImagePreview.value) {
    URL.revokeObjectURL(storyImagePreview.value);
    storyImagePreview.value = null;
  }
  storyImageFile.value = file;
  if (file) {
    storyImagePreview.value = URL.createObjectURL(file);
  }
};

const clearStoryFile = () => {
  if (storyImagePreview.value) {
    URL.revokeObjectURL(storyImagePreview.value);
    storyImagePreview.value = null;
  }
  storyImageFile.value = null;
};

const handleCreateStory = async () => {
  createError.value = null;
  createSuccess.value = null;
  isCreatingStory.value = true;

  try {
    await createStory({
      title: createForm.title,
      text: createForm.text,
      collection: 'Общее',
      imageFile: storyImageFile.value,
      img: createForm.imgUrl,
    });
    createForm.title = '';
    createForm.text = '';
    createForm.imgUrl = '';
    clearStoryFile();
    createSuccess.value = 'История опубликована!';
    await Promise.all([loadStories(), checkSession()]);
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Не удалось создать историю';
  } finally {
    isCreatingStory.value = false;
  }
};

const handleToggleLike = async (story: Story) => {
  feedNotice.value = null;
  try {
    const res = await toggleStoryLike(story.id);
    const target = stories.value.find((s) => s.id === story.id);
    if (target) {
      target.likes = res.likes;
      target.likedByMe = res.likedByMe;
    }
    if (currentUser.value) {
      await checkSession();
    }
  } catch (e) {
    feedNotice.value = e instanceof Error ? e.message : 'Войдите, чтобы поставить лайк';
  }
};

onMounted(() => {
  loadStories();
  checkSession();
});
</script>

<template>
  <div id="Stories">
    <p v-if="feedNotice" class="feed-notice">{{ feedNotice }}</p>

    <main class="feed">
      <p v-if="isLoading">Загрузка...</p>
      <p v-else-if="error">{{ error }}</p>
      <p v-else-if="stories.length === 0" class="empty-feed">
        Историй пока нет.
      </p>
      <article
        v-else
        v-for="story in stories"
        :key="story.id"
        class="card"
        :style="
          story.img
            ? { backgroundImage: `url(${resolveMediaUrl(story.img)})` }
            : {}
        "
      >
        <div class="background">
          <div class="header">
            <div class="profile-story">
              <p><b>@{{ story.account.toLowerCase() }}</b></p>
            </div>
          </div>
          <div class="content">
            <h2>{{ story.title }}</h2>
            <p>{{ story.text }}</p>
            <div class="story-actions">
              <button
                type="button"
                class="like-btn"
                :class="{ liked: story.likedByMe }"
                @click="handleToggleLike(story)"
              >
                <span class="like-heart">{{ story.likedByMe ? '♥' : '♡' }}</span>
                <span>{{ story.likes }}</span>
              </button>
            </div>
          </div>
        </div>
      </article>
    </main>
  </div>

  <!-- ИМЯ-ТИП-БЛОК  story-card-create -->
  <div id="Create">
    <section class="create-section">
      <div v-if="currentUser" class="create-card-form">
        <h2>Добавить историю</h2>
        <form class="story-form" @submit.prevent="handleCreateStory">
          <input
            v-model="createForm.title"
            type="text"
            name="title"
            maxlength="80"
            placeholder="Заголовок истории"
            required
          >
          <textarea
            v-model="createForm.text"
            name="text"
            rows="3"
            placeholder="Расскажите свою историю..."
            required
          ></textarea>
          <div class="file-upload-row">
            <label class="file-label">
              <span>{{ storyImageFile ? storyImageFile.name : 'Выбрать картинку' }}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                @change="handleStoryFileChange"
              >
            </label>
            <button
              v-if="storyImageFile"
              type="button"
              class="secondary-btn"
              @click="clearStoryFile"
            >
              Убрать
            </button>
          </div>
          <img
            v-if="storyImagePreview"
            :src="storyImagePreview"
            alt="Предпросмотр"
            class="story-preview-img"
          >
          <input
            v-if="!storyImageFile"
            v-model="createForm.imgUrl"
            type="text"
            name="img"
            placeholder="Или ссылка на картинку (необязательно)"
          >
          <p v-if="createError" class="auth-error">{{ createError }}</p>
          <p v-if="createSuccess" class="auth-success">{{ createSuccess }}</p>
          <button type="submit" :disabled="isCreatingStory">
            {{ isCreatingStory ? 'Публикация...' : 'Опубликовать' }}
          </button>
        </form>
      </div>
      <div v-else class="create-card-form">
        <h2>Добавить историю</h2>
        <p class="muted-text">
          Войдите или зарегистрируйтесь во вкладке «Аккаунт», чтобы публиковать истории.
        </p>
      </div>
    </section>

    <h3 class="section-heading">Подборка всех историй</h3>
    <div id="all-stories">
      <div v-for="story in stories" :key="story.id" class="story-card-create">
        <img
          v-if="story.img"
          height="150"
          width="100"
          :src="resolveMediaUrl(story.img)"
          :alt="story.title"
        >
        <div v-else class="story-card-placeholder">
          <span>{{ story.title }}</span>
        </div>
        <div class="story-card-meta">
          <p><b>{{ story.title }}</b></p>
          <p class="story-card-sub">@{{ story.account.toLowerCase() }} · ♥ {{ story.likes }}</p>
          <button
            v-if="isStoryOwner(story)"
            type="button"
            class="secondary-btn mini-delete-btn"
            :disabled="deletingStoryId === story.id"
            @click="handleDeleteStory(story.id)"
          >
            {{ deletingStoryId === story.id ? 'Удаление...' : 'Удалить' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <div id="account">
    <div v-if="isAuthChecking" id="login">
      <p>Проверка сессии...</p>
    </div>
    <div v-else-if="!currentUser" id="login">
      <p v-if="authError" class="auth-error">{{ authError }}</p>

      <form @submit.prevent="handleLogin">
        <div id="login-box-auth">
          <h2>Вход</h2>
          <input
            v-model="loginForm.login"
            type="text"
            name="login"
            autocomplete="username"
            placeholder="Логин или email. Например: jon_kilka"
            required
          >
          <input
            v-model="loginForm.password"
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Пароль"
            required
          >
          <button type="submit" :disabled="isAuthSubmitting">
            {{ isAuthSubmitting ? 'Вход...' : 'Войти' }}
          </button>
        </div>
      </form>

      <form @submit.prevent="handleRegister">
        <div id="reg-box-auth">
          <h2>Регистрация</h2>
          <input
            v-model="registerForm.account"
            type="text"
            name="account"
            autocomplete="username"
            placeholder="Аккаунт / логин. Например: jon_kilka"
            required
          >
          <input
            v-model="registerForm.email"
            type="email"
            name="email"
            autocomplete="email"
            placeholder="Email"
            required
          >
          <input
            v-model="registerForm.password"
            type="password"
            name="password"
            autocomplete="new-password"
            minlength="8"
            placeholder="Пароль (от 8 символов)"
            required
          >
          <button type="submit" :disabled="isAuthSubmitting">
            {{ isAuthSubmitting ? 'Регистрация...' : 'Регистрация' }}
          </button>
        </div>
      </form>
    </div>

    <div v-else class="profile-page">
      <div class="profile-topbar">
        <span class="profile-topbar-username">@{{ currentUser.account }}</span>
        <button
          type="button"
          class="hamburger-btn"
          aria-label="Настройки"
          :aria-expanded="isSettingsOpen"
          @click="isSettingsOpen = !isSettingsOpen"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      <div v-if="isSettingsOpen" class="settings-drawer">
        <div class="settings-header">
          <b>Настройки</b>
          <button
            type="button"
            class="secondary-btn settings-close-btn"
            @click="isSettingsOpen = false"
          >
            ✕
          </button>
        </div>
        <p class="muted-text settings-email">Email: {{ currentUser.email }}</p>
        <label class="settings-action-label">
          <span>{{ isAvatarUploading ? 'Загрузка аватара...' : 'Сменить аватар' }}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            :disabled="isAvatarUploading"
            @change="handleAvatarChange"
          >
        </label>
        <p v-if="avatarError" class="auth-error">{{ avatarError }}</p>
        <p v-if="authError" class="auth-error">{{ authError }}</p>
        <button
          type="button"
          class="settings-logout-btn"
          :disabled="isAuthSubmitting"
          @click="handleLogout"
        >
          {{ isAuthSubmitting ? 'Выход...' : 'Выйти из аккаунта' }}
        </button>
      </div>

      <div class="profile-header-row">
        <div class="profile-avatar-box">
          <img
            :src="resolveMediaUrl(currentUser.avatar, DEFAULT_AVATAR)"
            :alt="currentUser.account"
            class="profile-avatar"
          >
          <label class="avatar-plus-badge" title="Сменить аватар">
            <span>+</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              :disabled="isAvatarUploading"
              @change="handleAvatarChange"
            >
          </label>
        </div>

        <div class="profile-stats-row">
          <div class="profile-stat-item">
            <span class="stat-value">{{ currentUser.storiesCount }}</span>
            <span class="stat-label">Истории</span>
          </div>
          <div class="profile-stat-item">
            <span class="stat-value">{{ currentUser.totalLikes }}</span>
            <span class="stat-label">Лайки</span>
          </div>
        </div>
      </div>

      <div class="profile-bio">
        <p class="profile-display-name">{{ currentUser.account }}</p>
        <p class="profile-email-line">{{ currentUser.email }}</p>
      </div>

      <p v-if="avatarError && !isSettingsOpen" class="auth-error">{{ avatarError }}</p>
      <p v-if="profileError" class="auth-error">{{ profileError }}</p>

      <div class="profile-grid-tabs">
        <div class="profile-grid-tab active" aria-label="Мои истории">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
          </svg>
        </div>
      </div>

      <p v-if="userStories.length === 0" class="profile-empty-grid">
        У вас пока нет историй. Создайте первую во вкладке «Создать».
      </p>

      <div v-else class="profile-stories-grid">
        <div
          v-for="story in userStories"
          :key="story.id"
          class="profile-grid-tile"
          @click="selectedProfileStory = story"
        >
          <img
            v-if="story.img"
            :src="resolveMediaUrl(story.img)"
            :alt="story.title"
            class="profile-grid-img"
          >
          <div v-else class="profile-grid-text-cover">
            <span>{{ story.title }}</span>
          </div>

          <span class="tile-likes-badge">♥ {{ story.likes }}</span>
          <button
            type="button"
            class="tile-delete-btn"
            aria-label="Удалить историю"
            title="Удалить историю"
            :disabled="deletingStoryId === story.id"
            @click.stop="handleDeleteStory(story.id)"
          >
            {{ deletingStoryId === story.id ? '…' : '✕' }}
          </button>
        </div>
      </div>

      <div
        v-if="selectedProfileStory"
        class="story-modal-backdrop"
        @click.self="selectedProfileStory = null"
      >
        <div class="story-modal-card">
          <div class="story-modal-header">
            <b>{{ selectedProfileStory.title }}</b>
            <button
              type="button"
              class="secondary-btn settings-close-btn"
              @click="selectedProfileStory = null"
            >
              ✕
            </button>
          </div>
          <img
            v-if="selectedProfileStory.img"
            :src="resolveMediaUrl(selectedProfileStory.img)"
            :alt="selectedProfileStory.title"
            class="story-modal-img"
          >
          <p class="story-modal-text">{{ selectedProfileStory.text }}</p>
          <div class="story-modal-footer">
            <span>♥ {{ selectedProfileStory.likes }}</span>
            <button
              type="button"
              :disabled="deletingStoryId === selectedProfileStory.id"
              @click="handleDeleteStory(selectedProfileStory.id)"
            >
              {{ deletingStoryId === selectedProfileStory.id ? 'Удаление...' : 'Удалить историю' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css?family=Nunito');

button {
  font-family: 'Nunito', sans-serif;
  background-color: black;
  border: none;
  border-radius: 15px;
  color: #ffffff;
  padding: 7px 14px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-btn {
  background-color: #fef7ff;
  color: black;
  border: 1px solid gray;
}

input,
textarea,
select {
  font-family: 'Nunito', sans-serif;
  background-color: #ffffff;
  border: 1px solid gray;
  border-radius: 15px;
  padding: 8px 12px;
  width: 100%;
  box-sizing: border-box;
}

#login-box-auth,
#reg-box-auth,
#account-profile,
.create-card-form {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 10px;
  border: 2px solid gray;
  border-radius: 30px;
  padding: 18px 24px;
  width: min(340px, 88vw);
  background: #fef7ff;
}

.auth-error {
  color: #b00020;
  font-weight: 700;
  margin: 0;
  text-align: center;
}

.auth-success {
  color: #1b6e35;
  font-weight: 700;
  margin: 0;
  text-align: center;
}

.muted-text {
  color: #5f5b66;
  margin: 0;
  text-align: center;
}

#login {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 16px;
  min-height: 75dvh;
  padding: 12px 0 96px;
}

#Create {
  font-family: 'Nunito', sans-serif;
  display: none;
  padding: 12px 12px 96px;
}

#account {
  font-family: 'Nunito', sans-serif;
  display: none;
}

.create-section {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.story-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.file-upload-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 7px 12px;
  border: 1px dashed gray;
  border-radius: 15px;
  cursor: pointer;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.story-preview-img {
  width: 100%;
  max-height: 160px;
  object-fit: cover;
  border-radius: 15px;
}

.section-heading {
  text-align: center;
  margin: 12px 0;
}

.feed-notice {
  text-align: center;
  color: #b00020;
  font-family: 'Nunito', sans-serif;
  font-size: 14px;
  margin: 0 0 6px;
}

.empty-feed {
  font-family: 'Nunito', sans-serif;
  color: #5f5b66;
  margin-top: 40px;
}

.story-card-create {
  display: flex;
  width: 240px;
  border: 2px solid gray;
  border-radius: 15px;
  overflow: hidden;
  align-items: center;
  background: #fef7ff;
}

.story-card-create img {
  object-fit: cover;
  flex-shrink: 0;
}

.story-card-placeholder {
  width: 100px;
  height: 150px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2c2a2f;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  padding: 6px;
  box-sizing: border-box;
  text-align: center;
}

.story-card-meta {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.story-card-meta p {
  margin: 0;
}

.story-card-sub {
  font-size: 12px;
  color: #5f5b66;
}

.mini-tag {
  display: inline-block;
  width: fit-content;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid gray;
  background: #fef7ff;
  color: black;
}

#all-stories {
  justify-content: center;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.feed {
  height: calc(100dvh - 160px);
  min-height: 360px;
  overflow-y: auto;
  scroll-snap-type: y mandatory;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 0;
  scrollbar-width: none;
}

.feed::-webkit-scrollbar {
  display: none;
}

.card {
  margin: 2px;
  width: 100%;
  max-width: 380px;
  height: 100%;
  flex-shrink: 0;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  background-color: #2c2a2f;
  background-size: cover;
  background-position: center;
  color: #ffffff;
  font-family: 'Nunito', sans-serif;
}

.background {
  background: rgba(0, 0, 0, 0.55);
  box-sizing: border-box;
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.profile-story {
  display: flex;
  background-color: #fef7ff;
  color: black;
  width: fit-content;
  max-width: 500px;
  height: 25px;
  border-radius: 15px;
  overflow: hidden;
  margin: 0;
  align-items: center;
  justify-content: center;
  border: 2px solid gray;
  padding: 0 8px;
}

.profile-story p {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.story-collection-pill {
  background-color: #fef7ff;
  color: black;
  border: 2px solid gray;
  padding: 2px 10px;
  border-radius: 15px;
  font-size: 12px;
  font-weight: 700;
}

.story-actions {
  display: flex;
  align-items: center;
  margin-top: 10px;
}

.like-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: #fef7ff;
  color: black;
  border: 2px solid gray;
  border-radius: 15px;
  padding: 4px 12px;
  font-size: 14px;
  font-weight: 700;
}

.like-btn.liked {
  background-color: black;
  color: #ffffff;
  border-color: black;
}

.like-heart {
  font-size: 16px;
  line-height: 1;
}

.profile-page {
  max-width: 420px;
  margin: 0 auto;
  padding: 8px 12px 96px;
  background-color: #fef7ff;
  color: black;
}

.profile-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0 12px;
}

.profile-topbar-username {
  font-size: 18px;
  font-weight: 800;
}

.hamburger-btn {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 34px;
  height: 28px;
  padding: 5px;
  background-color: #fef7ff;
  border: 1px solid gray;
  border-radius: 8px;
}

.hamburger-btn span {
  display: block;
  width: 100%;
  height: 2px;
  background-color: black;
  border-radius: 2px;
}

.settings-drawer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 2px solid gray;
  border-radius: 15px;
  padding: 12px 14px;
  margin-bottom: 14px;
  background-color: #fef7ff;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-close-btn {
  padding: 2px 8px;
  font-size: 13px;
}

.settings-email {
  text-align: left;
  font-size: 13px;
}

.settings-action-label {
  display: block;
  text-align: center;
  padding: 7px 12px;
  border: 1px solid gray;
  border-radius: 15px;
  background-color: #ffffff;
  color: black;
  font-size: 14px;
  cursor: pointer;
}

.settings-logout-btn {
  width: 100%;
}

.profile-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 12px;
}

.profile-avatar-box {
  position: relative;
  width: 84px;
  height: 84px;
  flex-shrink: 0;
}

.profile-avatar {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid gray;
}

.avatar-plus-badge {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: black;
  color: #ffffff;
  border: 2px solid #fef7ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.profile-stats-row {
  flex: 1;
  display: flex;
  justify-content: space-around;
  align-items: center;
  gap: 12px;
}

.profile-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 20px;
  font-weight: 800;
  color: black;
}

.stat-label {
  font-size: 13px;
  color: #5f5b66;
}

.profile-bio {
  margin-bottom: 14px;
}

.profile-display-name {
  margin: 0;
  font-weight: 800;
  font-size: 15px;
}

.profile-email-line {
  margin: 2px 0 0;
  font-size: 13px;
  color: #5f5b66;
}

.profile-grid-tabs {
  display: flex;
  border-top: 1px solid #d0cbd6;
  border-bottom: 1px solid #d0cbd6;
  margin-bottom: 4px;
}

.profile-grid-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
  color: black;
}

.profile-grid-tab.active {
  border-bottom: 2px solid black;
}

.profile-empty-grid {
  text-align: center;
  color: #5f5b66;
  padding: 28px 12px;
}

.profile-stories-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
}

.profile-grid-tile {
  position: relative;
  aspect-ratio: 1 / 1;
  background-color: #2c2a2f;
  overflow: hidden;
  cursor: pointer;
}

.profile-grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-grid-text-cover {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  box-sizing: border-box;
  text-align: center;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}

.tile-likes-badge {
  position: absolute;
  left: 4px;
  bottom: 4px;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
}

.tile-delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.72);
  color: #ffffff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-delete-btn {
  width: fit-content;
  padding: 3px 10px;
  font-size: 12px;
  margin-top: 2px;
}

.story-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 200;
}

.story-modal-card {
  width: min(360px, 92vw);
  background: #fef7ff;
  border: 2px solid gray;
  border-radius: 20px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.story-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.story-modal-img {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  border-radius: 12px;
}

.story-modal-text {
  margin: 0;
  font-size: 14px;
}

.story-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
