<template>
  <div class="playerInfo" :id="'player-'+player.name">
    <div class="player-box" :class="{ active: isActive }">
      <div class="name-container">
        <p>{{ player.name }}</p>
      </div>
      <div class="player-image-container">
        <div class="temp-image">
          <div v-html="regenerate(player.randomString)"></div>
        </div>
        
      </div>
    </div>
    <span :style="{ color: hand.length <= 5 ? '#FF2400' : 'white' }">{{ hand.length }}枚</span>
  </div>
</template>

<script>
export default {
  props: {
    player: {
      type: Object,
      required: true
    },
    isActive: {
      type: Boolean,
      required: true
    },
    hand: {
      type: Array,
      required: true
    },
  },
  methods: {
    regenerate(randomString) {
      return window.multiavatar(randomString);
    },
  }
};
</script>
