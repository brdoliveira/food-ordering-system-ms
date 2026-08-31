package com.food.ordering.system.domain.valueobject;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MoneyTest {

    @Test
    void normalizesTheAmountToTwoDecimalPlaces() {
        Money money = new Money(new BigDecimal("12.5"));

        assertEquals(new BigDecimal("12.50"), money.getAmount());
    }

    @Test
    void considersEquivalentAmountsWithDifferentScalesEqual() {
        Money amountWithOneDecimalPlace = new Money(new BigDecimal("12.5"));
        Money amountWithThreeDecimalPlaces = new Money(new BigDecimal("12.500"));

        assertEquals(amountWithOneDecimalPlace, amountWithThreeDecimalPlaces);
        assertEquals(amountWithOneDecimalPlace.hashCode(), amountWithThreeDecimalPlaces.hashCode());
    }

    @Test
    void preservesTwoDecimalPlacesForArithmeticOperations() {
        Money amount = new Money(new BigDecimal("10.10"));

        assertEquals(new BigDecimal("12.35"), amount.add(new Money(new BigDecimal("2.25"))).getAmount());
        assertEquals(new BigDecimal("7.85"), amount.subtract(new Money(new BigDecimal("2.25"))).getAmount());
        assertEquals(new BigDecimal("30.30"), amount.multiply(3).getAmount());
    }

    @Test
    void rejectsNullAmountsImmediately() {
        assertThrows(NullPointerException.class, () -> new Money(null));
    }
}
