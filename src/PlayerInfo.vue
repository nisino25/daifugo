<template>
  <div class="playerInfo">
    <div class="player-box" :class="{ active: isActive }">
      <div class="name-container">
        <p>{{ player.name }}</p>
      </div>
      <div class="player-image-container">
        <div class="temp-image"></div>
        <!-- <img src="" alt=""> -->
      </div>
    </div>
    <span>{{hand.length}}枚</span>
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
  }
};
</script>
