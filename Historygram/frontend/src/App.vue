<script setup lang="ts">
import { ref } from 'vue'



interface Story {
  id: number,
  author: string,
  title: string,
  text: string,
  likes: number,
  img?: string
}
const Stories = ref<Story[]>([
  {
    id: 1,
    author: 'Джон Килька',
    title: 'Прогресс сообщества',
    text: 'Учитывая ключевые сценарии поведения, существующая теория позволяет оценить значение прогресса профессионального сообщества. Но выбранный нами инновационный путь в значительной степени обусловливает важность новых предложений.',
    likes: 0,
    img: '/jpg.png'
  },
  {
    id: 2,
    author: 'Джон Килька Второй',
    title: 'Прогресс сообщества',
    text: 'Учитывая ключевые сценарии поведения, существующая теория позволяет оценить значение прогресса профессионального сообщества. Но выбранный нами инновационный путь в значительной степени обусловливает важность новых предложений.',
    likes: 0,
    img: '/jpg.png'
  },
  {
    id: 3,
    author: 'Джон Килька 3',
    title: 'Прогресс сообщества',
    text: 'Учитывая ключевые сценарии поведения, существующая теория позволяет оценить значение прогресса профессионального сообщества. Но выбранный нами инновационный путь в значительной степени обусловливает важность новых предложений.',
    likes: 0,
    img: '/jpg.png'
  }
])


</script>

<template>
<div id="Stories">
  <main class="feed">
    
      <article v-for="story in Stories" :key="story.id" class="card" :style="{ backgroundImage: `url(${story.img})` }">
        <div class="background">
          <div class="header">
            <div class="profile-story">
              <p><b>{{ story.author }}</b></p>
            </div>

          </div>
          <div class="content">
            <h2>{{ story.title }}</h2>
            <p>{{ story.text }}</p>
          </div>
        </div>
      </article>
  </main>
  </div>
  <!-- ИМЯ-ТИП-БЛОК  story-card-create -->
  <div id="Create">
    <div id="all-stories">
      <div v-for="story in Stories" class="story-card-create">
          <img height="150px" width="100px" :src="story.img" :alt="story.title">
          <p><b>{{ story.title }}</b></p>
      </div>
    </div>
    
  </div>

</template>

<style scoped>
@import url('https://fonts.googleapis.com/css?family=Nunito');


#Create {
  font-family: 'Nunito', sans-serif;
  display: flex;
  display: none;
  
}
.story-card-create {
  display: flex;
  width: 200px;
  border: 2px solid gray;
  border-radius: 15px;
  overflow: hidden;

  & p {
    margin: 5px;
  }
}
#all-stories {
  justify-content: center;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}
.feed {
  height: calc(100dvh - 160px);
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

.profile-story {
  display: flex;
  background-color: #fef7ff;
  color: black;
  width: fit-content;
  max-width: 500px;
  height: 25px;
  border-radius: 15px;
  overflow: hidden;
  padding: 0;
  margin: 0;
  align-items: center;
  justify-content: center;
  border: 2px solid gray;
  padding: 0 5px;
}
</style>
