<template>
  <div class="gameCard">
    <div class="card-info">
      <div :class="['suit-icon', `suit-${card.suit}`]"></div>
      <span :class="{'vertical-text': card.rank == 'Joker'}">{{ card.rank }}</span>
    </div>
    <div class="card-detail">
      <div :class="['suit-icon', `suit-${card.suit}`]"></div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    card: {
      type: Object,
      required: true
    }
  },
};
</script>
